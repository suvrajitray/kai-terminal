using System.Text.Json;
using KAITerminal.Api.Models;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Models;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Services;

/// <summary>
/// Provides unified, broker-agnostic option contract master data with DB caching (once per IST day).
/// </summary>
public sealed class MasterDataService(
    AppDbContext db,
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

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task<IReadOnlyList<IndexContracts>> GetContractsAsync(
        string broker, HttpContext httpContext, CancellationToken ct)
    {
        var today = IstToday();

        // Cache hit?
        var cached = await db.OptionContracts
            .FirstOrDefaultAsync(o => o.Broker == broker, ct);

        if (cached is not null && cached.LastUpdatedDate == today)
        {
            logger.LogInformation("MasterData cache hit for broker={Broker} date={Date}", broker, today);
            return JsonSerializer.Deserialize<IReadOnlyList<IndexContracts>>(cached.Data, JsonOpts)!;
        }

        // Cache miss — fetch from broker
        logger.LogInformation("MasterData cache miss for broker={Broker}, fetching from broker API", broker);

        var contracts = broker == "zerodha"
            ? await FetchZerodhaAsync(ct)
            : await FetchUpstoxAsync(httpContext, ct);

        var json = JsonSerializer.Serialize(contracts, JsonOpts);

        if (cached is null)
        {
            db.OptionContracts.Add(new OptionContractCache
            {
                Broker          = broker,
                Data            = json,
                LastUpdatedDate = today,
                UpdatedAt       = DateTime.UtcNow,
            });
        }
        else
        {
            cached.Data            = json;
            cached.LastUpdatedDate = today;
            cached.UpdatedAt       = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return contracts;
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
}
