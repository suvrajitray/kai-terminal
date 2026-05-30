using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.OrderRouting;
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
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var creds    = ZerodhaTokenContext.Current!.Value;
            var brokerRequest = new BrokerOrderRequest(
                request.InstrumentToken, request.Quantity, request.TransactionType,
                request.Product, request.OrderType, request.Price, request.TriggerPrice,
                request.Exchange);
            var orderId = await orderRouter.PlaceZerodhaOrderAsync(
                username, creds.AccessToken, creds.ApiKey, brokerRequest, ct);
            logger.LogInformation(
                "Order placed — {User} — {Token} qty={Qty} {Side} — order {OrderId}",
                username, request.InstrumentToken, request.Quantity, request.TransactionType, orderId);
            return Results.Ok(new { orderId });
        });

        group.MapPost("/orders/cancel-all", async (
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var creds    = ZerodhaTokenContext.Current!.Value;
            var ids      = await orderRouter.CancelAllZerodhaOrdersAsync(
                username, creds.AccessToken, creds.ApiKey, ct);
            logger.LogInformation(
                "Cancel all pending orders — {User} — {Count} order(s) cancelled",
                username, ids.Count);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapDelete("/orders/{orderId}", async (
            string orderId,
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var creds    = ZerodhaTokenContext.Current!.Value;
            var id       = await orderRouter.CancelZerodhaOrderAsync(
                username, creds.AccessToken, creds.ApiKey, orderId, ct);
            logger.LogInformation(
                "Order cancelled — {User} — {OrderId}", username, id);
            return Results.Ok(new { OrderId = id });
        });

        group.MapPost("/orders/by-price", async (
            [FromBody] ByPriceOrderRequest request,
            ByPriceOrderService byPriceSvc,
            IOrderRouter orderRouter,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            ClaimsPrincipal user,
            CancellationToken ct) =>
            await byPriceSvc.PlaceZerodhaAsync(
                request, zerodha, zerodhaInstruments,
                user.GetEmail() ?? "unknown", logger, ct, orderRouter));
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
