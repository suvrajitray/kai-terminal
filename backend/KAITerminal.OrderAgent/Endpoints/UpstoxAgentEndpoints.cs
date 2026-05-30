using KAITerminal.Broker;
using KAITerminal.OrderRouting.Models;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Services;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.OrderAgent.Endpoints;

internal static class UpstoxAgentEndpoints
{
    internal static void Map(WebApplication app)
    {
        app.MapDelete("/upstox/orders/cancel-all", async (
            HttpContext ctx,
            IBrokerOrderService orders,
            CancellationToken ct) =>
        {
            var token = RequireHeader(ctx, "X-Upstox-Access-Token");
            using var _ = UpstoxTokenContext.Use(token);
            var ids = await orders.CancelAllPendingOrdersAsync(ct);
            return Results.Ok(new { orderIds = ids });
        });

        app.MapDelete("/upstox/orders/{orderId}", async (
            string orderId,
            HttpContext ctx,
            IUpstoxHftService hft,
            CancellationToken ct) =>
        {
            var token = RequireHeader(ctx, "X-Upstox-Access-Token");
            using var _ = UpstoxTokenContext.Use(token);
            var (id, latency) = await hft.CancelOrderV3Async(orderId, ct);
            return Results.Ok(new { orderId = id, latency });
        });

        app.MapPost("/upstox/orders", async (
            HttpContext ctx,
            [FromBody] UpstoxOrderRequest request,
            IUpstoxHftService hft,
            CancellationToken ct) =>
        {
            var token = RequireHeader(ctx, "X-Upstox-Access-Token");
            using var _ = UpstoxTokenContext.Use(token);

            var upstoxRequest = new PlaceOrderRequest
            {
                InstrumentToken = request.InstrumentToken,
                Quantity        = request.Quantity,
                TransactionType = Enum.Parse<TransactionType>(request.TransactionType),
                OrderType       = Enum.Parse<OrderType>(request.OrderType),
                Product         = Enum.Parse<Product>(request.Product),
                Validity        = Enum.Parse<Validity>(request.Validity),
                Price           = request.Price,
                TriggerPrice    = request.TriggerPrice,
                Slice           = request.Slice,
                Tag             = request.Tag
            };

            var result = await hft.PlaceOrderV3Async(upstoxRequest, ct);
            return Results.Ok(result);
        });
    }

    private static string RequireHeader(HttpContext ctx, string name)
        => ctx.Request.Headers[name].FirstOrDefault()
           ?? throw new BadHttpRequestException($"{name} header is required", 400);
}
