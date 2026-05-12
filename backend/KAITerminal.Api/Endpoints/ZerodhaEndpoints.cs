using KAITerminal.Api.Models;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

public static class ZerodhaEndpoints
{
    public static void MapZerodhaEndpoints(this IEndpointRouteBuilder app)
    {
        var logger = app.ServiceProvider.GetRequiredService<ILoggerFactory>()
                        .CreateLogger("ZerodhaEndpoints");
        var group = app.MapGroup("/api/zerodha").RequireAuthorization();

        ZerodhaAuthEndpoints.Map(group, logger);
        ZerodhaPositionEndpoints.Map(group, logger);
        ZerodhaOrderEndpoints.Map(group, logger);

        // ── Margin ────────────────────────────────────────────────────────────

        group.MapPost("/margin", async (
            [FromBody] MarginRequest request,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            CancellationToken ct) =>
        {
            var contracts = await zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);
            var items = new List<BrokerMarginOrderItem>();
            foreach (var i in request.Instruments)
            {
                var exchangeToken = i.InstrumentToken.Contains('|') ? i.InstrumentToken.Split('|')[1] : i.InstrumentToken;
                var match = contracts.FirstOrDefault(c => c.ExchangeToken == exchangeToken);
                if (match is null) continue;
                items.Add(new BrokerMarginOrderItem($"{match.Exchange}|{match.TradingSymbol}", i.Quantity, i.Product, i.TransactionType));
            }
            var margin = await zerodha.Margin.GetRequiredMarginAsync(items, ct);
            return Results.Ok(new { requiredMargin = margin.RequiredMargin, finalMargin = margin.FinalMargin });
        });

        // ── Funds ─────────────────────────────────────────────────────────────

        group.MapGet("/funds", async (ZerodhaClient zerodha, CancellationToken ct) =>
        {
            try
            {
                var funds = await zerodha.Funds.GetFundsAsync(ct);
                return Results.Ok(new
                {
                    availableMargin = funds.Available,
                    usedMargin      = funds.Used,
                    payinAmount     = funds.Payin,
                });
            }
            catch
            {
                return Results.Ok(new
                {
                    availableMargin = (decimal?)null,
                    usedMargin      = (decimal?)null,
                    payinAmount     = (decimal?)null,
                });
            }
        });
    }
}
