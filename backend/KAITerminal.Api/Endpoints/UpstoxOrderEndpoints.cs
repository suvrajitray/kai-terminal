using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.OrderRouting;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

internal static class UpstoxOrderEndpoints
{
    internal static void Map(RouteGroupBuilder group, ILogger logger)
    {
        group.MapGet("/orders", async (UpstoxClient upstox, CancellationToken ct) =>
            Results.Ok((await upstox.Orders.GetAllOrdersAsync(ct)).Select(o => o.ToResponse())));

        group.MapPost("/orders/v3", async (
            [FromBody] PlaceOrderRequest request,
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var token    = UpstoxTokenContext.Current!;
            var result   = await orderRouter.PlaceUpstoxOrderAsync(username, token, request, ct);
            logger.LogInformation(
                "Order placed — {User} — qty={Qty} {Symbol} {Side} @ {Price} — ids=[{OrderIds}] latency={Latency}ms",
                username, request.Quantity, request.InstrumentToken, request.TransactionType,
                request.Price, string.Join(",", result.OrderIds), result.Latency);
            return Results.Ok(result);
        });

        group.MapPost("/orders/cancel-all", async (
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var token    = UpstoxTokenContext.Current!;
            var ids      = await orderRouter.CancelAllUpstoxOrdersAsync(username, token, ct);
            logger.LogInformation(
                "Cancel all pending orders — {User} — {Count} order(s) cancelled",
                username, ids.Count);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapDelete("/orders/{orderId}/v3", async (
            string orderId,
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var token    = UpstoxTokenContext.Current!;
            var (id, latency) = await orderRouter.CancelUpstoxOrderAsync(username, token, orderId, ct);
            logger.LogInformation(
                "Order cancelled — {User} — {OrderId} — latency {Latency}ms",
                username, id, latency);
            return Results.Ok(new { OrderId = id, Latency = latency });
        });

        group.MapPost("/orders/by-price", async (
            [FromBody] ByPriceOrderRequest request,
            ByPriceOrderService byPriceSvc,
            IOrderRouter orderRouter,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            CancellationToken ct) =>
            await byPriceSvc.PlaceUpstoxAsync(
                request, upstox, user.GetEmail() ?? "unknown", logger, ct, orderRouter));
    }
}
