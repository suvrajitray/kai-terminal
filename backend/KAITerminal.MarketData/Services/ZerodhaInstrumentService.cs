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

        int tokenIdx         = Idx("instrument_token");
        int exchangeTokenIdx = Idx("exchange_token");
        int symbolIdx        = Idx("tradingsymbol");
        int nameIdx          = Idx("name");
        int lastPriceIdx     = Idx("last_price");
        int expiryIdx        = Idx("expiry");
        int strikeIdx        = Idx("strike");
        int tickIdx          = Idx("tick_size");
        int lotIdx           = Idx("lot_size");
        int typeIdx          = Idx("instrument_type");
        int segmentIdx       = Idx("segment");

        if (tokenIdx < 0 || typeIdx < 0 || expiryIdx < 0)
        {
            _logger.LogWarning("ParseCsv({Exchange}): required column missing. Headers: [{Headers}]",
                exchange, string.Join(", ", headers));
            return [];
        }

        var contracts = new List<ZerodhaOptionContract>();

        foreach (var line in lines.Skip(1))
        {
            var cols = line.TrimEnd('\r').Split(',');
            if (cols.Length <= typeIdx) continue;

            var instrType = Unquote(cols[typeIdx]);
            if (instrType is not ("CE" or "PE")) continue;

            var segment = segmentIdx >= 0 && cols.Length > segmentIdx ? Unquote(cols[segmentIdx]) : "";
            if (!AllowedSegments.Contains(segment)) continue;

            var name = nameIdx >= 0 ? Unquote(cols[nameIdx]) : "";
            if (!AllowedUnderlyings.Contains(name)) continue;

            var instrumentToken = Unquote(cols[tokenIdx]);
            var exchangeToken   = exchangeTokenIdx >= 0 && cols.Length > exchangeTokenIdx
                ? Unquote(cols[exchangeTokenIdx]) : "";
            var expiry = Unquote(cols[expiryIdx]);

            _ = decimal.TryParse(cols.Length > strikeIdx    ? Unquote(cols[strikeIdx])    : "", out var strike);
            _ = decimal.TryParse(cols.Length > tickIdx      ? Unquote(cols[tickIdx])      : "", out var tick);
            _ = decimal.TryParse(cols.Length > lotIdx       ? Unquote(cols[lotIdx])       : "", out var lot);
            _ = decimal.TryParse(cols.Length > lastPriceIdx ? Unquote(cols[lastPriceIdx]) : "", out var lastPrice);

            contracts.Add(new ZerodhaOptionContract(
                InstrumentToken: instrumentToken,
                ExchangeToken:   exchangeToken,
                TradingSymbol:   symbolIdx >= 0 ? Unquote(cols[symbolIdx]) : "",
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
            ));
        }

        _logger.LogInformation("ParseCsv({Exchange}): parsed {Count} CE/PE contracts", exchange, contracts.Count);
        return contracts;
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
