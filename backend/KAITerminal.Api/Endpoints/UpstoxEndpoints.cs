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

        // ── Positions ─────────────────────────────────────────────────────────

        group.MapGet("/positions", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var positions = await upstox.GetAllPositionsAsync();
                return Results.Ok(positions);
            }
        });

        group.MapGet("/mtm", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var mtm = await upstox.GetTotalMtmAsync();
                return Results.Ok(new { Mtm = mtm });
            }
        });

        group.MapPost("/positions/exit-all", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox,
            [FromQuery] OrderType? orderType = null,
            [FromQuery] Product? product = null) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var orderIds = await upstox.ExitAllPositionsAsync(
                    orderType ?? OrderType.Market,
                    product ?? Product.Intraday);
                return Results.Ok(new { OrderIds = orderIds });
            }
        });

        group.MapPost("/positions/{instrumentToken}/exit", async (
            string instrumentToken,
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox,
            [FromQuery] OrderType? orderType = null,
            [FromQuery] Product? product = null) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var orderId = await upstox.ExitPositionAsync(
                    instrumentToken,
                    orderType ?? OrderType.Market,
                    product ?? Product.Intraday);
                return Results.Ok(new { OrderId = orderId });
            }
        });

        // ── Orders ────────────────────────────────────────────────────────────

        group.MapGet("/orders", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var orders = await upstox.GetAllOrdersAsync();
                return Results.Ok(orders);
            }
        });

        group.MapPost("/orders", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            [FromBody] PlaceOrderRequest request,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var result = await upstox.PlaceOrderAsync(request);
                return Results.Ok(result);
            }
        });

        group.MapPost("/orders/v3", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            [FromBody] PlaceOrderRequest request,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var result = await upstox.PlaceOrderV3Async(request);
                return Results.Ok(result);
            }
        });

        group.MapPost("/orders/cancel-all", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var orderIds = await upstox.CancelAllPendingOrdersAsync();
                return Results.Ok(new { OrderIds = orderIds });
            }
        });

        group.MapDelete("/orders/{orderId}", async (
            string orderId,
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var id = await upstox.CancelOrderAsync(orderId);
                return Results.Ok(new { OrderId = id });
            }
        });

        group.MapDelete("/orders/{orderId}/v3", async (
            string orderId,
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var (id, latency) = await upstox.CancelOrderV3Async(orderId);
                return Results.Ok(new { OrderId = id, Latency = latency });
            }
        });

        // ── Options ───────────────────────────────────────────────────────────

        group.MapGet("/options/chain", async (
            [FromQuery] string underlyingKey,
            [FromQuery] string expiryDate,
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var chain = await upstox.GetOptionChainAsync(underlyingKey, expiryDate);
                return Results.Ok(chain);
            }
        });

        group.MapGet("/options/contracts", async (
            [FromQuery] string underlyingKey,
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            UpstoxClient upstox,
            [FromQuery] string? expiryDate = null) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var contracts = await upstox.GetOptionContractsAsync(underlyingKey, expiryDate);
                return Results.Ok(contracts);
            }
        });

        group.MapPost("/orders/by-option-price/resolve", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            [FromBody] PlaceOrderByOptionPriceRequest request,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var resolved = await upstox.GetOrderByOptionPriceAsync(request);
                return Results.Ok(resolved);
            }
        });

        group.MapPost("/orders/by-option-price", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            [FromBody] PlaceOrderByOptionPriceRequest request,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var result = await upstox.PlaceOrderByOptionPriceAsync(request);
                return Results.Ok(result);
            }
        });

        group.MapPost("/orders/by-option-price/v3", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            [FromBody] PlaceOrderByOptionPriceRequest request,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var result = await upstox.PlaceOrderByOptionPriceV3Async(request);
                return Results.Ok(result);
            }
        });

        group.MapPost("/orders/by-strike/resolve", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            [FromBody] PlaceOrderByStrikeRequest request,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var resolved = await upstox.GetOrderByStrikeAsync(request);
                return Results.Ok(resolved);
            }
        });

        group.MapPost("/orders/by-strike", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            [FromBody] PlaceOrderByStrikeRequest request,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var result = await upstox.PlaceOrderByStrikeAsync(request);
                return Results.Ok(result);
            }
        });

        group.MapPost("/orders/by-strike/v3", async (
            [FromHeader(Name = "X-Upstox-AccessToken")] string accessToken,
            [FromBody] PlaceOrderByStrikeRequest request,
            UpstoxClient upstox) =>
        {
            using (UpstoxTokenContext.Use(accessToken))
            {
                var result = await upstox.PlaceOrderByStrikeV3Async(request);
                return Results.Ok(result);
            }
        });

        // ── Auth ──────────────────────────────────────────────────────────────

        group.MapPost("/access-token", async (
            [FromBody] UpstoxTokenRequest request,
            UpstoxClient upstox) =>
        {
            var token = await upstox.GenerateTokenAsync(
                request.ApiKey,
                request.ApiSecret,
                request.RedirectUri,
                request.Code);
            return Results.Ok(new { AccessToken = token.AccessToken });
        });
    }
}
