using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Exceptions;
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
            UpstoxClient upstox,
            BrokerCredentialService credentials,
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            var (accessToken, brokerUserId) = await upstox.Auth.GenerateTokenWithUserIdAsync(
                request.ApiKey, request.ApiSecret, request.Code, request.RedirectUri);
            var username = user.GetEmail() ?? "";
            if (!string.IsNullOrEmpty(username) && !string.IsNullOrEmpty(brokerUserId))
                await credentials.UpdateBrokerUserIdAsync(username, BrokerNames.Upstox, brokerUserId);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Upstox access token generated — {User} upstoxUserId={UserId}", username, brokerUserId);
            return Results.Ok(new { AccessToken = accessToken });
        });

        // ── Positions ─────────────────────────────────────────────────────────

        group.MapGet("/positions", async (
            UpstoxClient upstox,
            [FromQuery] string? exchange = null) =>
        {
            var positions = await upstox.Positions.GetAllPositionsAsync();
            return Results.Ok(FilterByExchange(positions, exchange).Select(p => p.ToResponse()));
        });

        group.MapPost("/positions/exit-all", async (
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            [FromQuery] string? exchange = null) =>
        {
            var logger = lf.CreateLogger("UpstoxEndpoints");
            var email = user.GetEmail() ?? "unknown";
            var filterDesc = string.IsNullOrWhiteSpace(exchange) ? "all exchanges" : exchange;
            logger.LogInformation("Exit all positions — {User} — filter: {Filter}", email, filterDesc);

            var exchanges = string.IsNullOrWhiteSpace(exchange)
                ? null
                : exchange.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                          .ToList()
                          .AsReadOnly();
            var ids = await upstox.Positions.ExitAllPositionsAsync(exchanges);

            logger.LogInformation(
                "Exit all complete — {User} — {Count} order(s) placed", email, ids.Count);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapPost("/positions/{instrumentToken}/exit", async (
            string instrumentToken,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            [FromQuery] string product = "I") =>
        {
            var id = await upstox.Positions.ExitPositionAsync(instrumentToken, product);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Exit position — {User} — {Token} ({Product}) — order {OrderId}",
                user.GetEmail() ?? "unknown", instrumentToken, product, id);
            return Results.Ok(new { OrderId = id });
        });

        group.MapPost("/positions/{instrumentToken}/convert", async (
            string instrumentToken,
            [FromBody] ConvertPositionRequest request,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            await upstox.Positions.ConvertPositionAsync(instrumentToken, request.OldProduct, request.Quantity);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Convert position — {User} — {Token} qty={Qty} from {OldProduct}",
                user.GetEmail() ?? "unknown",
                instrumentToken, request.Quantity, request.OldProduct);
            return Results.Ok();
        });

        group.MapPost("/positions/shift", async (
            [FromBody] ShiftPositionRequest request,
            PositionShiftService shiftSvc,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            CancellationToken ct) =>
            await shiftSvc.ShiftUpstoxAsync(
                request, upstox, user.GetEmail() ?? "unknown",
                lf.CreateLogger("UpstoxEndpoints"), ct));

        // ── Orders ────────────────────────────────────────────────────────────

        group.MapGet("/orders", async (UpstoxClient upstox, CancellationToken ct) =>
            Results.Ok((await upstox.Orders.GetAllOrdersAsync(ct)).Select(o => o.ToResponse())));

        group.MapPost("/orders/v3", async (
            [FromBody] PlaceOrderRequest request,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            var result = await upstox.Hft.PlaceOrderV3Async(request);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Order placed — {User} — qty={Qty} {Symbol} {Side} @ {Price} — ids=[{OrderIds}] latency={Latency}ms",
                user.GetEmail() ?? "unknown",
                request.Quantity, request.InstrumentToken, request.TransactionType, request.Price,
                string.Join(",", result.OrderIds), result.Latency);
            return Results.Ok(result);
        });

        group.MapPost("/orders/cancel-all", async (
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            var ids = await upstox.Orders.CancelAllPendingOrdersAsync();
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Cancel all pending orders — {User} — {Count} order(s) cancelled",
                user.GetEmail() ?? "unknown", ids.Count);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapDelete("/orders/{orderId}/v3", async (
            string orderId,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            var (id, latency) = await upstox.Hft.CancelOrderV3Async(orderId);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Order cancelled — {User} — {OrderId} — latency {Latency}ms",
                user.GetEmail() ?? "unknown", id, latency);
            return Results.Ok(new { OrderId = id, Latency = latency });
        });

        group.MapPost("/orders/by-price", async (
            [FromBody] ByPriceOrderRequest request,
            ByPriceOrderService byPriceSvc,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            CancellationToken ct) =>
            await byPriceSvc.PlaceUpstoxAsync(
                request, upstox, user.GetEmail() ?? "unknown",
                lf.CreateLogger("UpstoxEndpoints"), ct));

        // ── Funds ─────────────────────────────────────────────────────────────

        group.MapGet("/funds", async (UpstoxClient upstox, CancellationToken ct) =>
        {
            try
            {
                var funds = await upstox.Funds.GetFundsAsync(ct);
                return Results.Ok(new
                {
                    availableMargin = funds.Available,
                    usedMargin      = funds.Used,
                    payinAmount     = funds.Payin,
                });
            }
            catch (UpstoxException)
            {
                // Funds API is unavailable outside 05:30–00:00 IST — return null so the
                // frontend shows "—" rather than crashing.
                return Results.Ok(new { availableMargin = (decimal?)null, usedMargin = (decimal?)null, payinAmount = (decimal?)null });
            }
        });

        // ── Margin ────────────────────────────────────────────────────────────

        group.MapPost("/margin", async (
            [FromBody] MarginRequest request,
            UpstoxClient upstox) =>
        {
            var items = request.Instruments.Select(i =>
                new BrokerMarginOrderItem(i.InstrumentToken, i.Quantity, i.Product, i.TransactionType));
            var margin = await upstox.Margin.GetRequiredMarginAsync(items);
            return Results.Ok(new { requiredMargin = margin.RequiredMargin, finalMargin = margin.FinalMargin });
        });
    }

    /// <summary>
    /// Filters positions by a comma-separated exchange list (e.g. "NFO,BFO").
    /// Returns all positions when <paramref name="exchange"/> is null or empty.
    /// </summary>
    private static IReadOnlyList<BrokerPosition> FilterByExchange(
        IReadOnlyList<BrokerPosition> positions,
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
