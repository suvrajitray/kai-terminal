using KAITerminal.Contracts;
using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Services;
using KAITerminal.MarketData.Http;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.MarketData.Options;

/// <summary>
/// Fetches Upstox option contracts using the admin analytics token (no user token required).
/// </summary>
internal sealed class UpstoxOptionContractProvider : IOptionContractProvider
{
    private static readonly Dictionary<string, string> UnderlyingToIndex = new()
    {
        ["NSE_INDEX|Nifty 50"]          = "NIFTY",
        ["BSE_INDEX|SENSEX"]            = "SENSEX",
        ["NSE_INDEX|Nifty Bank"]        = "BANKNIFTY",
        ["NSE_INDEX|Nifty Fin Service"] = "FINNIFTY",
        ["BSE_INDEX|BANKEX"]            = "BANKEX",
    };

    private readonly UpstoxMarketDataHttpClient _http;
    private readonly IServiceScopeFactory       _scopeFactory;

    public UpstoxOptionContractProvider(UpstoxMarketDataHttpClient http, IServiceScopeFactory scopeFactory)
    {
        _http         = http;
        _scopeFactory = scopeFactory;
    }

    public string BrokerType => BrokerNames.Upstox;

    public async Task<IReadOnlyList<IndexContracts>> GetContractsAsync(
        string accessToken, string? apiKey, CancellationToken ct)
    {
        // Use analytics token — user token is ignored for contract fetching
        using var scope = _scopeFactory.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAppSettingService>();
        var token = await svc.GetAsync(AppSettingKeys.UpstoxAnalyticsToken, ct)
            ?? throw new InvalidOperationException("Analytics token not configured.");

        var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(5.5));

        var tasks = UnderlyingToIndex.Select(async kvp =>
        {
            var all = await _http.GetOptionContractsAsync(token, kvp.Key, ct: ct);

            var entries = all
                .Where(c =>
                    (c.InstrumentType == "CE" || c.InstrumentType == "PE") &&
                    DateOnly.TryParse(c.Expiry, out var expiry) && expiry.Year == today.Year)
                .OrderBy(c => c.Expiry)
                .Select(c => new ContractEntry(
                    c.Expiry, c.ExchangeToken, (int)c.LotSize,
                    c.InstrumentType,
                    UpstoxToken: c.InstrumentKey,
                    ZerodhaToken: "",
                    c.StrikePrice))
                .ToList();

            return new IndexContracts(kvp.Value, entries);
        });

        return await Task.WhenAll(tasks);
    }
}
