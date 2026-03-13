using KAITerminal.Api.Models;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Requests;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.Api.Endpoints;

public static class UpstoxEndpoints
{
    public static void MapUpstoxEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/upstox").RequireAuthorization();

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

        group.MapGet("/positions", async (
            UpstoxClient upstox,
            [FromQuery] string? exchange = null) =>
        {
            var positions = await upstox.GetAllPositionsAsync();
            return Results.Ok(FilterByExchange(positions, exchange));
        });

        group.MapGet("/mtm", async (
            UpstoxClient upstox,
            [FromQuery] string? exchange = null) =>
        {
            var positions = await upstox.GetAllPositionsAsync();
            var filtered = FilterByExchange(positions, exchange);
            return Results.Ok(new { Mtm = filtered.Sum(p => p.Pnl) });
        });

        group.MapPost("/positions/exit-all", async (
            UpstoxClient upstox,
            [FromQuery] string? exchange = null) =>
        {
            var exchanges = string.IsNullOrWhiteSpace(exchange)
                ? null
                : exchange.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                          .ToList()
                          .AsReadOnly();
            var ids = await upstox.ExitAllPositionsAsync(exchanges);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapPost("/positions/{instrumentToken}/exit", async (
            string instrumentToken,
            UpstoxClient upstox,
            [FromQuery] string product = "I") =>
        {
            var id = await upstox.ExitPositionAsync(instrumentToken, product);
            return Results.Ok(new { OrderId = id });
        });

        // ── Orders ────────────────────────────────────────────────────────────

        group.MapGet("/orders", async (UpstoxClient upstox) =>
            Results.Ok(await upstox.GetAllOrdersAsync()));

        group.MapPost("/orders/v3", async (
            [FromBody] PlaceOrderRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.PlaceOrderV3Async(request)));

        group.MapPost("/orders/cancel-all", async (UpstoxClient upstox) =>
            Results.Ok(new { OrderIds = await upstox.CancelAllPendingOrdersAsync() }));

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

        group.MapGet("/options/contracts/current-month", async (
            [FromQuery] string? underlyingKey,
            UpstoxClient upstox) =>
        {
            if (string.IsNullOrEmpty(underlyingKey))
                return Results.BadRequest(new { error = "underlyingKey is required." });

            var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(5.5));
            var contracts = await upstox.GetOptionContractsAsync(underlyingKey);
            var currentMonth = contracts
                .Where(c => DateOnly.TryParse(c.Expiry, out var expiry)
                            && expiry.Year == today.Year
                            && expiry.Month == today.Month)
                .OrderBy(c => c.Expiry)
                .ToList();

            return Results.Ok(currentMonth);
        });

        group.MapGet("/options/contracts/current-year", async (
            [FromQuery] string? underlyingKey,
            UpstoxClient upstox) =>
        {
            if (string.IsNullOrEmpty(underlyingKey))
                return Results.BadRequest(new { error = "underlyingKey is required." });

            var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(5.5));
            var contracts = await upstox.GetOptionContractsAsync(underlyingKey);
            var currentYear = contracts
                .Where(c => DateOnly.TryParse(c.Expiry, out var expiry) && expiry.Year == today.Year)
                .OrderBy(c => c.Expiry)
                .ToList();

            return Results.Ok(currentYear);
        });

        group.MapGet("/orders/by-option-price/resolve", async (
            [AsParameters] ResolveByOptionPriceQuery q,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.GetOrderByOptionPriceAsync(
                q.UnderlyingKey, q.ExpiryDate, q.OptionType, q.TargetPremium, q.PriceSearchMode)));

        group.MapPost("/orders/by-option-price/v3", async (
            [FromBody] PlaceOrderByOptionPriceRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.PlaceOrderByOptionPriceV3Async(request)));

        group.MapGet("/orders/by-strike/resolve", async (
            [AsParameters] ResolveByStrikeQuery q,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.GetOrderByStrikeAsync(
                q.UnderlyingKey, q.ExpiryDate, q.OptionType, q.StrikeType)));

        group.MapPost("/orders/by-strike/v3", async (
            [FromBody] PlaceOrderByStrikeRequest request,
            UpstoxClient upstox) =>
            Results.Ok(await upstox.PlaceOrderByStrikeV3Async(request)));
    }

    /// <summary>
    /// Filters positions by a comma-separated exchange list (e.g. "NFO,BFO").
    /// Returns all positions when <paramref name="exchange"/> is null or empty.
    /// </summary>
    private static IReadOnlyList<Upstox.Models.Responses.Position> FilterByExchange(
        IReadOnlyList<Upstox.Models.Responses.Position> positions,
        string? exchange)
    {
        if (string.IsNullOrWhiteSpace(exchange))
            return positions;

        var exchanges = exchange
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToUpperInvariant())
            .ToHashSet();

        return positions
            .Where(p => exchanges.Contains(p.Exchange.ToUpperInvariant()))
            .ToList()
            .AsReadOnly();
    }
}
