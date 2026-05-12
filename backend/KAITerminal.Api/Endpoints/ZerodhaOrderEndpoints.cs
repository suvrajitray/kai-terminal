using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

internal static class ZerodhaOrderEndpoints
{
    internal static void Map(RouteGroupBuilder group, ILogger logger)
    {
        group.MapGet("/orders", async (ZerodhaClient zerodha, CancellationToken ct) =>
            Results.Ok((await zerodha.Orders.GetAllOrdersAsync(ct)).Select(o => o.ToResponse())));

        group.MapPost("/orders/v3", async (
            [FromBody] ZerodhaOrderRequest request,
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var brokerRequest = new BrokerOrderRequest(
                request.InstrumentToken,
                request.Quantity,
                request.TransactionType,
                request.Product,
                request.OrderType,
                request.Price,
                request.TriggerPrice,
                request.Exchange);
            var orderId = await zerodha.Orders.PlaceOrderAsync(brokerRequest, ct);
            logger.LogInformation(
                "Order placed — {User} — {Token} qty={Qty} {Side} — order {OrderId}",
                user.GetEmail() ?? "unknown",
                request.InstrumentToken, request.Quantity, request.TransactionType, orderId);
            return Results.Ok(new { orderId });
        });

        group.MapPost("/orders/cancel-all", async (
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var ids = await zerodha.Orders.CancelAllPendingOrdersAsync(ct);
            logger.LogInformation(
                "Cancel all pending orders — {User} — {Count} order(s) cancelled",
                user.GetEmail() ?? "unknown", ids.Count);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapDelete("/orders/{orderId}", async (
            string orderId,
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var id = await zerodha.Orders.CancelOrderAsync(orderId, ct);
            logger.LogInformation(
                "Order cancelled — {User} — {OrderId}",
                user.GetEmail() ?? "unknown", id);
            return Results.Ok(new { OrderId = id });
        });

        group.MapPost("/orders/by-price", async (
            [FromBody] ByPriceOrderRequest request,
            ByPriceOrderService byPriceSvc,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            ClaimsPrincipal user,
            CancellationToken ct) =>
            await byPriceSvc.PlaceZerodhaAsync(
                request, zerodha, zerodhaInstruments,
                user.GetEmail() ?? "unknown", logger, ct));
    }

    private sealed record ZerodhaOrderRequest(
        string   InstrumentToken,
        int      Quantity,
        string   TransactionType,
        string   Product,
        string   OrderType,
        decimal? Price        = null,
        decimal? TriggerPrice = null,
        string?  Exchange     = null);
}
