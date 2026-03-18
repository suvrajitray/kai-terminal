using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Zerodha.Services;

/// <summary>
/// Fetches and parses instrument master data from api.kite.trade/instruments/{exchange}.
/// The endpoint is public (no auth required) and returns a CSV with one row per contract.
/// </summary>
public sealed class ZerodhaInstrumentService : IZerodhaInstrumentService
{
    private static readonly string[] Exchanges = ["NFO", "BFO"];

    private readonly IHttpClientFactory _httpFactory;

    public ZerodhaInstrumentService(IHttpClientFactory httpFactory) =>
        _httpFactory = httpFactory;

    public async Task<IReadOnlyList<OptionContract>> GetCurrentYearContractsAsync(
        string underlyingSymbol, CancellationToken ct = default)
    {
        var year = DateTimeOffset.UtcNow.Year;

        var results = await Task.WhenAll(Exchanges.Select(ex => FetchContractsAsync(ex, ct)));

        return results
            .SelectMany(x => x)
            .Where(c =>
                c.UnderlyingSymbol.Equals(underlyingSymbol, StringComparison.OrdinalIgnoreCase) &&
                DateOnly.TryParse(c.Expiry, out var d) && d.Year == year)
            .OrderBy(c => c.Expiry)
            .ThenBy(c => c.StrikePrice)
            .ToList()
            .AsReadOnly();
    }

    private async Task<IReadOnlyList<OptionContract>> FetchContractsAsync(
        string exchange, CancellationToken ct)
    {
        var http = _httpFactory.CreateClient("ZerodhaData");
        var csv  = await http.GetStringAsync($"/instruments/{exchange}", ct);
        return ParseCsv(csv, exchange);
    }

    // ── CSV parsing ───────────────────────────────────────────────────────────

    private static IReadOnlyList<OptionContract> ParseCsv(string csv, string exchange)
    {
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2) return [];

        var headers    = lines[0].Split(',');
        int Idx(string col) => Array.IndexOf(headers, col);

        int tokenIdx   = Idx("instrument_token");
        int symbolIdx  = Idx("tradingsymbol");
        int nameIdx    = Idx("name");
        int expiryIdx  = Idx("expiry");
        int strikeIdx  = Idx("strike");
        int tickIdx    = Idx("tick_size");
        int lotIdx     = Idx("lot_size");
        int typeIdx    = Idx("instrument_type");
        int segmentIdx = Idx("segment");

        if (tokenIdx < 0 || typeIdx < 0 || expiryIdx < 0) return [];

        var contracts = new List<OptionContract>();

        foreach (var line in lines.Skip(1))
        {
            var cols = line.TrimEnd('\r').Split(',');
            if (cols.Length <= typeIdx) continue;

            var instrType = cols[typeIdx].Trim();
            if (instrType is not ("CE" or "PE")) continue;

            var token           = cols[tokenIdx].Trim();
            var underlyingName  = nameIdx >= 0 ? cols[nameIdx].Trim() : "";
            var expiry          = expiryIdx >= 0 ? cols[expiryIdx].Trim() : "";
            var segment         = segmentIdx >= 0 && cols.Length > segmentIdx ? cols[segmentIdx].Trim() : "";

            _ = decimal.TryParse(cols[strikeIdx].Trim(), out var strike);
            _ = decimal.TryParse(tickIdx >= 0 ? cols[tickIdx].Trim() : "", out var tick);
            _ = decimal.TryParse(lotIdx  >= 0 ? cols[lotIdx].Trim()  : "", out var lot);

            contracts.Add(new OptionContract
            {
                // instrument_key uses exchange|token to match ZerodhaHttpClient.MapPosition format
                InstrumentKey    = $"{exchange}|{token}",
                ExchangeToken    = token,
                TradingSymbol    = symbolIdx >= 0 ? cols[symbolIdx].Trim() : "",
                Expiry           = expiry,
                StrikePrice      = strike,
                TickSize         = tick,
                LotSize          = lot,
                InstrumentType   = instrType,
                Segment          = segment,
                Exchange         = exchange,
                UnderlyingKey    = "",
                UnderlyingSymbol = underlyingName,
                Weekly           = IsWeeklyExpiry(expiry),
            });
        }

        return contracts;
    }

    // ── Weekly detection ─────────────────────────────────────────────────────

    /// <summary>
    /// Monthly NFO/BFO options expire on the last Thursday of the month.
    /// Any other expiry in the same month is a weekly contract.
    /// </summary>
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
