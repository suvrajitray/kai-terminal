using KAITerminal.MarketData.Models;
using Microsoft.Extensions.Logging;

namespace KAITerminal.MarketData.Services;

/// <summary>
/// Fetches and parses instrument master data from api.kite.trade/instruments/{exchange}.
/// The endpoint is public (no auth required) and returns a CSV with one row per contract.
///
/// Results are cached in-process for the IST calendar day (invalidates at midnight IST).
/// NFO + BFO CSVs are downloaded at most once per day regardless of how many callers invoke these methods.
/// </summary>
public sealed class ZerodhaInstrumentService : IZerodhaInstrumentService
{
    private static readonly string[] Exchanges = ["NFO", "BFO"];

    private static readonly HashSet<string> AllowedSegments   = ["NFO-OPT", "BFO-OPT"];
    private static readonly HashSet<string> AllowedUnderlyings = ["NIFTY", "BANKNIFTY", "SENSEX", "BANKEX", "FINNIFTY"];

    private readonly IHttpClientFactory              _httpFactory;
    private readonly ILogger<ZerodhaInstrumentService> _logger;

    private IReadOnlyList<ZerodhaOptionContract>? _cache;
    private DateOnly                              _cachedDate;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public ZerodhaInstrumentService(IHttpClientFactory httpFactory, ILogger<ZerodhaInstrumentService> logger)
    {
        _httpFactory = httpFactory;
        _logger      = logger;
    }

    public async Task<IReadOnlyList<ZerodhaOptionContract>> GetCurrentYearContractsAsync(
        string underlyingSymbol, CancellationToken ct = default)
    {
        var all      = await GetAllCurrentYearContractsAsync(ct);
        var filtered = all
            .Where(c => c.Name.Equals(underlyingSymbol, StringComparison.OrdinalIgnoreCase))
            .ToList()
            .AsReadOnly();

        _logger.LogInformation(
            "GetCurrentYearContractsAsync({Symbol}): {Count} contracts (from cache)",
            underlyingSymbol, filtered.Count);

        return filtered;
    }

    public async Task<IReadOnlyList<ZerodhaOptionContract>> GetAllCurrentYearContractsAsync(
        CancellationToken ct = default)
    {
        var today = IstToday();
        if (_cachedDate == today && _cache is not null) return _cache;

        await _lock.WaitAsync(ct);
        try
        {
            if (_cachedDate == today && _cache is not null) return _cache;
            _cache      = await FetchAndFilterAsync(ct);
            _cachedDate = today;
            return _cache;
        }
        finally { _lock.Release(); }
    }

    private async Task<IReadOnlyList<ZerodhaOptionContract>> FetchAndFilterAsync(CancellationToken ct)
    {
        var year    = DateTimeOffset.UtcNow.Year;
        var results = await Task.WhenAll(Exchanges.Select(ex => FetchContractsAsync(ex, ct)));

        var filtered = results
            .SelectMany(x => x)
            .Where(c =>
                AllowedUnderlyings.Contains(c.Name) &&
                DateOnly.TryParse(c.Expiry, out var d) && d.Year == year)
            .OrderBy(c => c.Name)
            .ThenBy(c => c.Expiry)
            .ThenBy(c => c.Strike)
            .ToList()
            .AsReadOnly();

        _logger.LogInformation(
            "ZerodhaInstrumentService: fetched {Count} contracts (year={Year}) across {Underlyings} — cached until midnight IST",
            filtered.Count, year, string.Join(", ", AllowedUnderlyings));

        return filtered;
    }

    private static DateOnly IstToday() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5));

    private async Task<IReadOnlyList<ZerodhaOptionContract>> FetchContractsAsync(
        string exchange, CancellationToken ct)
    {
        var http     = _httpFactory.CreateClient("ZerodhaData");
        var response = await http.GetAsync($"/instruments/{exchange}", ct);

        _logger.LogInformation("ZerodhaData GET /instruments/{Exchange} → {Status}",
            exchange, (int)response.StatusCode);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogWarning("Instruments CSV fetch failed for {Exchange}: {Status} — {Body}",
                exchange, (int)response.StatusCode, body[..Math.Min(500, body.Length)]);
            return [];
        }

        var csv = await response.Content.ReadAsStringAsync(ct);
        _logger.LogInformation("Instruments CSV for {Exchange}: {Bytes} bytes, ~{Lines} lines",
            exchange, csv.Length, csv.Count(c => c == '\n'));

        return ParseCsv(csv, exchange);
    }

    private readonly record struct ColumnMap(
        int Token, int ExchangeToken, int Symbol, int Name, int LastPrice,
        int Expiry, int Strike, int Tick, int Lot, int Type, int Segment);

    private IReadOnlyList<ZerodhaOptionContract> ParseCsv(string csv, string exchange)
    {
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2)
        {
            _logger.LogWarning("ParseCsv({Exchange}): fewer than 2 lines in response", exchange);
            return [];
        }

        var headerLine = lines[0].TrimStart('\uFEFF').TrimEnd('\r');
        var headers    = headerLine.Split(',').Select(h => h.Trim()).ToArray();
        int Idx(string col) => Array.IndexOf(headers, col);

        var map = new ColumnMap(
            Token:         Idx("instrument_token"),
            ExchangeToken: Idx("exchange_token"),
            Symbol:        Idx("tradingsymbol"),
            Name:          Idx("name"),
            LastPrice:     Idx("last_price"),
            Expiry:        Idx("expiry"),
            Strike:        Idx("strike"),
            Tick:          Idx("tick_size"),
            Lot:           Idx("lot_size"),
            Type:          Idx("instrument_type"),
            Segment:       Idx("segment"));

        if (map.Token < 0 || map.Type < 0 || map.Expiry < 0)
        {
            _logger.LogWarning("ParseCsv({Exchange}): required column missing. Headers: [{Headers}]",
                exchange, string.Join(", ", headers));
            return [];
        }

        var contracts = new List<ZerodhaOptionContract>();
        foreach (var line in lines.Skip(1))
        {
            var contract = ParseRow(line.TrimEnd('\r').Split(','), map, exchange);
            if (contract is not null)
                contracts.Add(contract);
        }

        _logger.LogInformation("ParseCsv({Exchange}): parsed {Count} CE/PE contracts", exchange, contracts.Count);
        return contracts;
    }

    private static ZerodhaOptionContract? ParseRow(string[] cols, in ColumnMap map, string exchange)
    {
        if (cols.Length <= map.Type) return null;

        var instrType = Unquote(cols[map.Type]);
        if (instrType is not ("CE" or "PE")) return null;

        var segment = map.Segment >= 0 && cols.Length > map.Segment ? Unquote(cols[map.Segment]) : "";
        if (!AllowedSegments.Contains(segment)) return null;

        var name = map.Name >= 0 ? Unquote(cols[map.Name]) : "";
        if (!AllowedUnderlyings.Contains(name)) return null;

        var instrumentToken = Unquote(cols[map.Token]);
        var exchangeToken   = map.ExchangeToken >= 0 && cols.Length > map.ExchangeToken
            ? Unquote(cols[map.ExchangeToken]) : "";
        var expiry = Unquote(cols[map.Expiry]);

        _ = decimal.TryParse(cols.Length > map.Strike    ? Unquote(cols[map.Strike])    : "", out var strike);
        _ = decimal.TryParse(cols.Length > map.Tick      ? Unquote(cols[map.Tick])      : "", out var tick);
        _ = decimal.TryParse(cols.Length > map.Lot       ? Unquote(cols[map.Lot])       : "", out var lot);
        _ = decimal.TryParse(cols.Length > map.LastPrice ? Unquote(cols[map.LastPrice]) : "", out var lastPrice);

        return new ZerodhaOptionContract(
            InstrumentToken: instrumentToken,
            ExchangeToken:   exchangeToken,
            TradingSymbol:   map.Symbol >= 0 ? Unquote(cols[map.Symbol]) : "",
            Name:            name,
            LastPrice:       lastPrice,
            Expiry:          expiry,
            Strike:          strike,
            TickSize:        tick,
            LotSize:         lot,
            InstrumentType:  instrType,
            Segment:         segment,
            Exchange:        exchange,
            Weekly:          IsWeeklyExpiry(expiry)
        );
    }

    private static string Unquote(string s)
    {
        s = s.Trim();
        return s.Length >= 2 && s[0] == '"' && s[^1] == '"' ? s[1..^1] : s;
    }

    private static bool IsWeeklyExpiry(string expiry)
    {
        if (!DateOnly.TryParse(expiry, out var d)) return false;
        return d != LastThursdayOfMonth(d.Year, d.Month);
    }

    private static DateOnly LastThursdayOfMonth(int year, int month)
    {
        var last = new DateOnly(year, month, DateTime.DaysInMonth(year, month));
        while (last.DayOfWeek != DayOfWeek.Thursday)
            last = last.AddDays(-1);
        return last;
    }
}
