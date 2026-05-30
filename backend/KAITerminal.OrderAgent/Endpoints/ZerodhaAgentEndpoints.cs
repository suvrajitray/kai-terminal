using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.OrderRouting.Models;
using KAITerminal.Zerodha;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.OrderAgent.Endpoints;

internal static class ZerodhaAgentEndpoints
{
    internal static void Map(WebApplication app)
    {
        app.MapDelete("/zerodha/orders/cancel-all", async (
            HttpContext ctx,
            IBrokerOrderService orders,
            CancellationToken ct) =>
        {
            var (apiKey, token) = RequireZerodhaHeaders(ctx);
            using var _ = ZerodhaTokenContext.Use(apiKey, token);
            var ids = await orders.CancelAllPendingOrdersAsync(ct);
            return Results.Ok(new { orderIds = ids });
        });

        app.MapDelete("/zerodha/orders/{orderId}", async (
            string orderId,
            HttpContext ctx,
            IBrokerOrderService orders,
            CancellationToken ct) =>
        {
            var (apiKey, token) = RequireZerodhaHeaders(ctx);
            using var _ = ZerodhaTokenContext.Use(apiKey, token);
            var id = await orders.CancelOrderAsync(orderId, ct);
            return Results.Ok(new { orderId = id });
        });

        app.MapPost("/zerodha/orders", async (
            HttpContext ctx,
            [FromBody] ZerodhaOrderRequest request,
            IBrokerOrderService orders,
            CancellationToken ct) =>
        {
            var (apiKey, token) = RequireZerodhaHeaders(ctx);
            using var _ = ZerodhaTokenContext.Use(apiKey, token);

            var brokerRequest = new BrokerOrderRequest(
                request.InstrumentToken,
                request.Quantity,
                request.TransactionType,
                request.Product,
                request.OrderType,
                request.Price,
                request.TriggerPrice,
                request.Exchange,
                request.Tag);

            var orderId = await orders.PlaceOrderAsync(brokerRequest, ct);
            return Results.Ok(new { orderId });
        });
    }

    private static (string ApiKey, string Token) RequireZerodhaHeaders(HttpContext ctx)
    {
        var apiKey = ctx.Request.Headers["X-Zerodha-Api-Key"].FirstOrDefault()
                     ?? throw new BadHttpRequestException("X-Zerodha-Api-Key header is required", 400);
        var token  = ctx.Request.Headers["X-Zerodha-Access-Token"].FirstOrDefault()
                     ?? throw new BadHttpRequestException("X-Zerodha-Access-Token header is required", 400);
        return (apiKey, token);
    }
}
