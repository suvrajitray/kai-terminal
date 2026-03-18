using KAITerminal.Api.Models;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Zerodha;
using Microsoft.Extensions.Caching.Memory;

namespace KAITerminal.Api.Services;

/// <summary>
/// Provides unified, broker-agnostic option contract master data with in-memory caching (expires at IST midnight).
/// </summary>
public sealed class MasterDataService(
    IMemoryCache cache,
    UpstoxClient upstox,
    ZerodhaClient zerodha,
    ILogger<MasterDataService> logger)
{
    // Upstox underlying key → index name used as the store key on the frontend
    private static readonly Dictionary<string, string> UpstoxUnderlyingToIndex = new()
    {
        ["NSE_INDEX|Nifty 50"]          = "NIFTY",
        ["BSE_INDEX|SENSEX"]            = "SENSEX",
        ["NSE_INDEX|Nifty Bank"]        = "BANKNIFTY",
        ["NSE_INDEX|Nifty Fin Service"] = "FINNIFTY",
        ["BSE_INDEX|BANKEX"]            = "BANKEX",
    };

    // Zerodha uses the index name directly as the underlying symbol
    private static readonly string[] ZerodhaUnderlyingSymbols =
        ["NIFTY", "SENSEX", "BANKNIFTY", "FINNIFTY", "BANKEX"];

    public async Task<IReadOnlyList<IndexContracts>> GetContractsAsync(
        HttpContext httpContext, CancellationToken ct)
    {
        var upstoxToken  = httpContext.Request.Headers["X-Upstox-Access-Token"].FirstOrDefault();
        var zerodhaToken = httpContext.Request.Headers["X-Zerodha-Access-Token"].FirstOrDefault();
        bool hasUpstox   = !string.IsNullOrEmpty(upstoxToken);
        bool hasZerodha  = !string.IsNullOrEmpty(zerodhaToken);

        IReadOnlyList<IndexContracts>? upstoxContracts  = hasUpstox  ? await LoadBrokerContractsAsync("upstox",  httpContext, ct) : null;
        IReadOnlyList<IndexContracts>? zerodhaContracts = hasZerodha ? await LoadBrokerContractsAsync("zerodha", httpContext, ct) : null;

        if (upstoxContracts is not null && zerodhaContracts is not null)
            return MergeContracts(upstoxContracts, zerodhaContracts);

        return upstoxContracts ?? zerodhaContracts ?? [];
    }

    private async Task<IReadOnlyList<IndexContracts>> LoadBrokerContractsAsync(
        string broker, HttpContext httpContext, CancellationToken ct)
    {
        var key = $"contracts:{broker}:{IstToday()}";

        if (cache.TryGetValue(key, out IReadOnlyList<IndexContracts>? cached))
        {
            logger.LogInformation("MasterData cache hit for broker={Broker}", broker);
            return cached!;
        }

        logger.LogInformation("MasterData cache miss for broker={Broker}, fetching from broker API", broker);

        var contracts = broker == "zerodha"
            ? await FetchZerodhaAsync(ct)
            : await FetchUpstoxAsync(httpContext, ct);

        cache.Set(key, contracts, NextIst0815());
        return contracts;
    }

    private static IReadOnlyList<IndexContracts> MergeContracts(
        IReadOnlyList<IndexContracts> upstox,
        IReadOnlyList<IndexContracts> zerodha)
    {
        var zerodhaMap = zerodha.ToDictionary(z => z.Index);
        return upstox.Select(u =>
        {
            if (!zerodhaMap.TryGetValue(u.Index, out var z))
                return u;

            var zLookup = z.Contracts.ToDictionary(c => (c.Expiry, c.ExchangeToken));

            var merged = u.Contracts.Select(uc =>
                zLookup.TryGetValue((uc.Expiry, uc.ExchangeToken), out var zc)
                    ? uc with { ZerodhaToken = zc.ZerodhaToken }
                    : uc
            ).ToList();

            return new IndexContracts(u.Index, merged);
        }).ToList();
    }

    private async Task<IReadOnlyList<IndexContracts>> FetchUpstoxAsync(
        HttpContext httpContext, CancellationToken ct)
    {
        var token = httpContext.Request.Headers["X-Upstox-Access-Token"].FirstOrDefault();
        var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(5.5));

        var tasks = UpstoxUnderlyingToIndex.Select(async kvp =>
        {
            IReadOnlyList<OptionContract> all;
            using (UpstoxTokenContext.Use(token))
                all = await upstox.GetOptionContractsAsync(kvp.Key);

            var entries = all
                .Where(c =>
                    (c.InstrumentType == "CE" || c.InstrumentType == "PE") &&
                    DateOnly.TryParse(c.Expiry, out var expiry) && expiry.Year == today.Year)
                .OrderBy(c => c.Expiry)
                .Select(c => new ContractEntry(
                    c.Expiry, c.ExchangeToken, c.LotSize,
                    c.InstrumentType,
                    UpstoxToken: c.InstrumentKey,
                    ZerodhaToken: "",
                    c.StrikePrice))
                .ToList();

            return new IndexContracts(kvp.Value, entries);
        });

        return await Task.WhenAll(tasks);
    }

    private async Task<IReadOnlyList<IndexContracts>> FetchZerodhaAsync(CancellationToken ct)
    {
        var tasks = ZerodhaUnderlyingSymbols.Select(async symbol =>
        {
            var all = await zerodha.GetOptionContractsAsync(symbol, ct);

            var entries = all
                .Select(c => new ContractEntry(
                    c.Expiry, c.ExchangeToken, c.LotSize,
                    c.InstrumentType,
                    UpstoxToken: "",
                    ZerodhaToken: c.InstrumentToken,
                    c.Strike))
                .ToList();

            return new IndexContracts(symbol, entries);
        });

        return await Task.WhenAll(tasks);
    }

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
