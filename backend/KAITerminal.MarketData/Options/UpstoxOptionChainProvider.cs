using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Services;
using KAITerminal.MarketData.Http;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.MarketData.Options;

/// <summary>
/// Fetches live option chain data via the Upstox market data client using the admin analytics token.
/// No user token required.
/// </summary>
internal sealed class UpstoxOptionChainProvider : IOptionChainProvider
{
    private readonly UpstoxMarketDataHttpClient _http;
    private readonly IServiceScopeFactory       _scopeFactory;

    public UpstoxOptionChainProvider(UpstoxMarketDataHttpClient http, IServiceScopeFactory scopeFactory)
    {
        _http         = http;
        _scopeFactory = scopeFactory;
    }

    public async Task<IReadOnlyList<OptionChainEntry>> GetChainAsync(
        string underlyingKey, string expiryDate, CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAppSettingService>();
        var token = await svc.GetAsync(AppSettingKeys.UpstoxAnalyticsToken, ct)
            ?? throw new InvalidOperationException("Analytics token not configured.");

        return await _http.GetOptionChainAsync(token, underlyingKey, expiryDate, ct);
    }
}
