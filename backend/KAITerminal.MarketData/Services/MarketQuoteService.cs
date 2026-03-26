using KAITerminal.Infrastructure.Services;
using KAITerminal.MarketData.Http;
using KAITerminal.MarketData.Models;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.MarketData.Services;

internal sealed class MarketQuoteService : IMarketQuoteService
{
    private readonly UpstoxMarketDataHttpClient _http;
    private readonly IServiceScopeFactory       _scopeFactory;

    public MarketQuoteService(UpstoxMarketDataHttpClient http, IServiceScopeFactory scopeFactory)
    {
        _http         = http;
        _scopeFactory = scopeFactory;
    }

    public async Task<IReadOnlyDictionary<string, MarketQuote>> GetMarketQuotesAsync(
        IEnumerable<string> instrumentKeys, CancellationToken ct = default)
    {
        var token = await FetchTokenAsync(ct);
        return await _http.GetMarketQuotesAsync(token, instrumentKeys, ct);
    }

    private async Task<string> FetchTokenAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAppSettingService>();
        return await svc.GetAsync(AppSettingKeys.UpstoxAnalyticsToken, ct)
            ?? throw new InvalidOperationException("Analytics token not configured.");
    }
}
