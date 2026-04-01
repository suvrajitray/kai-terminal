using KAITerminal.Contracts;
using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Services;
using Microsoft.Extensions.Caching.Memory;

namespace KAITerminal.Api.Services;

/// <summary>
/// Provides unified, broker-agnostic option contract master data with in-memory caching (expires at 8:15 AM IST).
/// Upstox contracts are fetched using the admin-configured analytics token (read-only, from DB).
/// Zerodha contracts use per-user credentials from request headers.
/// </summary>
public sealed class MasterDataService(
    IMemoryCache cache,
    IEnumerable<IOptionContractProvider> providers,
    IServiceScopeFactory scopeFactory,
    ILogger<MasterDataService> logger)
{
    public async Task<IReadOnlyList<IndexContracts>> GetContractsAsync(
        HttpContext httpContext, CancellationToken ct)
    {
        var zerodhaToken  = httpContext.Request.Headers["X-Zerodha-Access-Token"].FirstOrDefault();
        var zerodhaApiKey = httpContext.Request.Headers["X-Zerodha-Api-Key"].FirstOrDefault();

        // Fetch the admin-configured analytics token for Upstox master data
        string? upstoxAnalyticsToken;
        using (var scope = scopeFactory.CreateScope())
        {
            var settingSvc = scope.ServiceProvider.GetRequiredService<IAppSettingService>();
            upstoxAnalyticsToken = await settingSvc.GetAsync(AppSettingKeys.UpstoxAnalyticsToken, ct);
        }

        var credsByBroker = new Dictionary<string, (string Token, string? ApiKey)>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrEmpty(upstoxAnalyticsToken))
            credsByBroker[BrokerNames.Upstox] = (upstoxAnalyticsToken, null);
        if (!string.IsNullOrEmpty(zerodhaToken))
            credsByBroker[BrokerNames.Zerodha] = (zerodhaToken, zerodhaApiKey);

        if (credsByBroker.Count == 0)
            return [];

        var fetchTasks = providers
            .Where(p => credsByBroker.ContainsKey(p.BrokerType))
            .Select(p =>
            {
                var (token, apiKey) = credsByBroker[p.BrokerType];
                return LoadBrokerContractsAsync(p, token, apiKey, ct);
            })
            .ToList();

        var results = await Task.WhenAll(fetchTasks);

        return results.Length switch
        {
            0 => [],
            1 => results[0],
            _ => MergeAll(results)
        };
    }

    private async Task<IReadOnlyList<IndexContracts>> LoadBrokerContractsAsync(
        IOptionContractProvider provider, string accessToken, string? apiKey, CancellationToken ct)
    {
        var key = $"contracts:{provider.BrokerType}:{IstToday()}";

        if (cache.TryGetValue(key, out IReadOnlyList<IndexContracts>? cached))
        {
            logger.LogInformation("MasterData cache hit for broker={Broker}", provider.BrokerType);
            return cached!;
        }

        logger.LogInformation("MasterData cache miss for broker={Broker}, fetching from broker API", provider.BrokerType);

        var contracts = await provider.GetContractsAsync(accessToken, apiKey, ct);
        cache.Set(key, contracts, NextIst0815());
        return contracts;
    }

    private static IReadOnlyList<IndexContracts> MergeAll(IReadOnlyList<IndexContracts>[] brokerResults)
    {
        var merged = brokerResults[0].ToDictionary(ic => ic.Index);

        foreach (var brokerContracts in brokerResults.Skip(1))
        {
            foreach (var incoming in brokerContracts)
            {
                if (!merged.TryGetValue(incoming.Index, out var existing))
                {
                    merged[incoming.Index] = incoming;
                    continue;
                }

                // Join key: ExchangeToken — the universal cross-broker instrument identifier.
                // Both Upstox and Zerodha use the same exchange_token for the same instrument.
                // Within one index (one exchange), exchange_token is unique.
                var incomingLookup = incoming.Contracts
                    .ToDictionary(c => c.ExchangeToken);

                var mergedEntries = existing.Contracts.Select(ec =>
                    incomingLookup.TryGetValue(ec.ExchangeToken, out var ic)
                        ? MergeEntry(ec, ic)
                        : ec
                ).ToList();

                merged[incoming.Index] = new IndexContracts(incoming.Index, mergedEntries);
            }
        }

        return merged.Values.ToList();
    }

    private static ContractEntry MergeEntry(ContractEntry a, ContractEntry b)
        => a with
        {
            UpstoxToken  = string.IsNullOrEmpty(a.UpstoxToken)  ? b.UpstoxToken  : a.UpstoxToken,
            ZerodhaToken = string.IsNullOrEmpty(a.ZerodhaToken) ? b.ZerodhaToken : a.ZerodhaToken,
        };

    private static DateOnly IstToday() =>
        DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5));

    private static DateTimeOffset NextIst0815()
    {
        var istOffset = TimeSpan.FromHours(5.5);
        var istNow    = DateTimeOffset.UtcNow.ToOffset(istOffset);
        var todayAt0815 = new DateTimeOffset(istNow.Date, istOffset).AddHours(8).AddMinutes(15);
        return istNow < todayAt0815 ? todayAt0815 : todayAt0815.AddDays(1);
    }
}
