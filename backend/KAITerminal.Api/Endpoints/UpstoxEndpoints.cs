using KAITerminal.Api.Models;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.Api.Endpoints;

public static class UpstoxEndpoints
{
    public static void MapUpstoxEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/upstox");

        // ── Auth ──────────────────────────────────────────────────────────────

        group.MapPost("/access-token", async (
            [FromBody] UpstoxTokenRequest request,
            UpstoxClient upstox) =>
        {
            var token = await upstox.GenerateTokenAsync(
                request.ApiKey, request.ApiSecret, request.RedirectUri, request.Code);
            return Results.Ok(new { AccessToken = token.AccessToken });
        });

        // ── Positions ─────────────────────────────────────────────────────────

        group.MapGet("/positions", async (UpstoxClient upstox) =>
            Results.Ok(await upstox.GetAllPositionsAsync()));

        group.MapGet("/mtm", async (UpstoxClient upstox) =>
            Results.Ok(new { Mtm = await upstox.GetTotalMtmAsync() }));

        group.MapPost("/positions/exit-all", async (
            UpstoxClient upstox,
            [FromQuery] OrderType? orderType = null,
            [FromQuery] Product? product = null) =>
        {
            var ids = await upstox.ExitAllPositionsAsync(
                orderType ?? OrderType.Market, product ?? Product.Intraday);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapPost("/positions/{instrumentToken}/exit", async (
            string instrumentToken,
            UpstoxClient upstox,
            [FromQuery] OrderType? orderType = null,
            [FromQuery] Product? product = null) =>
        {
            var id = await upstox.ExitPositionAsync(
                instrumentToken, orderType ?? OrderType.Market, product ?? Product.Intraday);
            return Results.Ok(new { OrderId = id });
        });

        // ── Orders ────────────────────────────────────────────────────────────

        group.MapGet("/orders", async (UpstoxClient upstox) =>
            Results.Ok(await upstox.GetAllOrdersAsync()));

        group.MapPost("/orders", async (
            [FromBody] PlaceOrderRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.PlaceOrderAsync(request)));

        group.MapPost("/orders/v3", async (
            [FromBody] PlaceOrderRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.PlaceOrderV3Async(request)));

        group.MapPost("/orders/cancel-all", async (UpstoxClient upstox) =>
            Results.Ok(new { OrderIds = await upstox.CancelAllPendingOrdersAsync() }));

        group.MapDelete("/orders/{orderId}", async (
            string orderId,
            UpstoxClient upstox) =>
            Results.Ok(new { OrderId = await upstox.CancelOrderAsync(orderId) }));

        group.MapDelete("/orders/{orderId}/v3", async (
            string orderId,
            UpstoxClient upstox) =>
        {
            var (id, latency) = await upstox.CancelOrderV3Async(orderId);
            return Results.Ok(new { OrderId = id, Latency = latency });
        });

        // ── Options ───────────────────────────────────────────────────────────

        group.MapGet("/options/chain", async (
            [FromQuery] string? underlyingKey,
            [FromQuery] string? expiryDate,
            UpstoxClient upstox) =>
        {
            if (string.IsNullOrEmpty(underlyingKey) || string.IsNullOrEmpty(expiryDate))
                return Results.BadRequest(new { error = "underlyingKey and expiryDate are required." });
            return Results.Ok(await upstox.GetOptionChainAsync(underlyingKey, expiryDate));
        });

        group.MapGet("/options/contracts", async (
            [FromQuery] string? underlyingKey,
            UpstoxClient upstox,
            [FromQuery] string? expiryDate = null) =>
        {
            if (string.IsNullOrEmpty(underlyingKey))
                return Results.BadRequest(new { error = "underlyingKey is required." });
            return Results.Ok(await upstox.GetOptionContractsAsync(underlyingKey, expiryDate));
        });

        group.MapPost("/orders/by-option-price/resolve", async (
            [FromBody] PlaceOrderByOptionPriceRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.GetOrderByOptionPriceAsync(request)));

        group.MapPost("/orders/by-option-price", async (
            [FromBody] PlaceOrderByOptionPriceRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.PlaceOrderByOptionPriceAsync(request)));

        group.MapPost("/orders/by-option-price/v3", async (
            [FromBody] PlaceOrderByOptionPriceRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.PlaceOrderByOptionPriceV3Async(request)));

        group.MapPost("/orders/by-strike/resolve", async (
            [FromBody] PlaceOrderByStrikeRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.GetOrderByStrikeAsync(request)));

        group.MapPost("/orders/by-strike", async (
            [FromBody] PlaceOrderByStrikeRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.PlaceOrderByStrikeAsync(request)));

        group.MapPost("/orders/by-strike/v3", async (
            [FromBody] PlaceOrderByStrikeRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.PlaceOrderByStrikeV3Async(request)));
    }
}
