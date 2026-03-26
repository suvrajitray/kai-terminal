using KAITerminal.Infrastructure.Services;
using KAITerminal.MarketData.Http;
using KAITerminal.MarketData.Models;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.MarketData.Services;

internal sealed class ChartDataService : IChartDataService
{
    private readonly UpstoxMarketDataHttpClient _http;
    private readonly IServiceScopeFactory       _scopeFactory;

    private static readonly IReadOnlyList<InstrumentSearchResult> CuratedInstruments =
    [
        new() { InstrumentKey = "NSE_INDEX|Nifty 50",           TradingSymbol = "Nifty 50",           Name = "NIFTY 50",            Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty Bank",          TradingSymbol = "Nifty Bank",          Name = "BANK NIFTY",          Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "BSE_INDEX|SENSEX",              TradingSymbol = "SENSEX",              Name = "BSE SENSEX",          Exchange = "BSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty Fin Service",   TradingSymbol = "Nifty Fin Service",   Name = "NIFTY FIN SERVICE",   Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty MidCap Select", TradingSymbol = "Nifty MidCap Select", Name = "NIFTY MIDCAP SELECT", Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "BSE_INDEX|BANKEX",              TradingSymbol = "BANKEX",              Name = "BSE BANKEX",          Exchange = "BSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty IT",            TradingSymbol = "Nifty IT",            Name = "NIFTY IT",            Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty Auto",          TradingSymbol = "Nifty Auto",          Name = "NIFTY AUTO",          Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty FMCG",          TradingSymbol = "Nifty FMCG",          Name = "NIFTY FMCG",          Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty Metal",         TradingSymbol = "Nifty Metal",         Name = "NIFTY METAL",         Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty Pharma",        TradingSymbol = "Nifty Pharma",        Name = "NIFTY PHARMA",        Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty Realty",        TradingSymbol = "Nifty Realty",        Name = "NIFTY REALTY",        Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty PSU Bank",      TradingSymbol = "Nifty PSU Bank",      Name = "NIFTY PSU BANK",      Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty Next 50",       TradingSymbol = "Nifty Next 50",       Name = "NIFTY NEXT 50",       Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty 100",           TradingSymbol = "Nifty 100",           Name = "NIFTY 100",           Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty 500",           TradingSymbol = "Nifty 500",           Name = "NIFTY 500",           Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty Smallcap 100",  TradingSymbol = "Nifty Smallcap 100",  Name = "NIFTY SMALLCAP 100",  Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|Nifty Midcap 100",    TradingSymbol = "Nifty Midcap 100",    Name = "NIFTY MIDCAP 100",    Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
        new() { InstrumentKey = "NSE_INDEX|India VIX",           TradingSymbol = "India VIX",           Name = "INDIA VIX",           Exchange = "NSE_INDEX", InstrumentType = "INDEX" },
    ];

    public ChartDataService(UpstoxMarketDataHttpClient http, IServiceScopeFactory scopeFactory)
    {
        _http         = http;
        _scopeFactory = scopeFactory;
    }

    public async Task<IReadOnlyList<CandleData>> GetHistoricalCandlesAsync(
        string instrumentKey, CandleInterval interval, DateOnly from, DateOnly to,
        CancellationToken ct = default)
    {
        var token = await GetTokenAsync(ct);
        return await _http.GetHistoricalCandlesAsync(token, instrumentKey, ToIntervalString(interval), from, to, ct);
    }

    public async Task<IReadOnlyList<CandleData>> GetIntradayCandlesAsync(
        string instrumentKey, CandleInterval interval,
        CancellationToken ct = default)
    {
        var token = await GetTokenAsync(ct);
        return await _http.GetIntradayCandlesAsync(token, instrumentKey, ToIntervalString(interval), ct);
    }

    public Task<IReadOnlyList<InstrumentSearchResult>> SearchInstrumentsAsync(
        string query, CancellationToken ct = default)
    {
        var q = query.Trim();
        var results = CuratedInstruments
            .Where(i => i.TradingSymbol.Contains(q, StringComparison.OrdinalIgnoreCase)
                     || i.Name.Contains(q, StringComparison.OrdinalIgnoreCase))
            .ToList()
            .AsReadOnly();
        return Task.FromResult<IReadOnlyList<InstrumentSearchResult>>(results);
    }

    private async Task<string> GetTokenAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAppSettingService>();
        return await svc.GetAsync(AppSettingKeys.UpstoxAnalyticsToken, ct)
            ?? throw new InvalidOperationException("Analytics token not configured.");
    }

    private static string ToIntervalString(CandleInterval interval) => interval switch
    {
        CandleInterval.OneMinute    => "1minute",
        CandleInterval.ThirtyMinute => "30minute",
        CandleInterval.OneDay       => "day",
        CandleInterval.OneWeek      => "week",
        CandleInterval.OneMonth     => "month",
        _ => throw new ArgumentOutOfRangeException(nameof(interval), interval, null)
    };
}
