using System.Security.Claims;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Exceptions;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;
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
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            var token = await upstox.GenerateTokenAsync(
                request.ApiKey, request.ApiSecret, request.RedirectUri, request.Code);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Upstox access token generated — {User}", user.FindFirstValue(ClaimTypes.Email) ?? "unknown");
            return Results.Ok(new { AccessToken = token.AccessToken });
        });

        // ── Positions ─────────────────────────────────────────────────────────

        group.MapGet("/positions", async (
            UpstoxClient upstox,
            [FromQuery] string? exchange = null) =>
        {
            var positions = await upstox.GetAllPositionsAsync();
            return Results.Ok(FilterByExchange(positions, exchange).Select(p => p.ToResponse()));
        });

        group.MapPost("/positions/exit-all", async (
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            [FromQuery] string? exchange = null) =>
        {
            var logger = lf.CreateLogger("UpstoxEndpoints");
            var email = user.FindFirstValue(ClaimTypes.Email) ?? "unknown";
            var filterDesc = string.IsNullOrWhiteSpace(exchange) ? "all exchanges" : exchange;
            logger.LogInformation("Exit all positions — {User} — filter: {Filter}", email, filterDesc);

            var exchanges = string.IsNullOrWhiteSpace(exchange)
                ? null
                : exchange.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                          .ToList()
                          .AsReadOnly();
            var ids = await upstox.ExitAllPositionsAsync(exchanges);

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
            var id = await upstox.ExitPositionAsync(instrumentToken, product);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Exit position — {User} — {Token} ({Product}) — order {OrderId}",
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown", instrumentToken, product, id);
            return Results.Ok(new { OrderId = id });
        });

        group.MapPost("/positions/{instrumentToken}/convert", async (
            string instrumentToken,
            [FromBody] ConvertPositionRequest request,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            await upstox.ConvertPositionAsync(instrumentToken, request.OldProduct, request.Quantity);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Convert position — {User} — {Token} qty={Qty} from {OldProduct}",
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown",
                instrumentToken, request.Quantity, request.OldProduct);
            return Results.Ok();
        });

        group.MapPost("/positions/shift", async (
            [FromBody] ShiftPositionRequest request,
            ShiftService shiftSvc,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            CancellationToken ct) =>
        {
            var targetKey = await shiftSvc.FindTargetStrikeAsync(
                request.UnderlyingKey, request.Expiry, request.InstrumentType,
                request.TargetPremium, request.Direction, ct);

            if (targetKey is null)
                return Results.Problem("No matching strike found in option chain.");

            var closeTxn = request.IsShort ? TransactionType.Buy  : TransactionType.Sell;
            var openTxn  = request.IsShort ? TransactionType.Sell : TransactionType.Buy;
            var product  = request.Product switch
            {
                "Delivery" or "D" or "NRML" => Product.Delivery,
                "Mtf"      or "MTF"          => Product.MTF,
                "CoverOrder" or "CO"         => Product.CoverOrder,
                _                            => Product.Intraday,
            };

            var closeOrder = new PlaceOrderRequest
            {
                InstrumentToken = request.InstrumentToken,
                Quantity        = request.Qty,
                TransactionType = closeTxn,
                Product         = product,
                Slice           = true,
            };
            var openOrder = new PlaceOrderRequest
            {
                InstrumentToken = targetKey,
                Quantity        = request.Qty,
                TransactionType = openTxn,
                Product         = product,
                Slice           = true,
            };

            var logger = lf.CreateLogger("UpstoxEndpoints");
            var email  = user.FindFirstValue(ClaimTypes.Email) ?? "unknown";

            // Short: close first (buying back releases margin), then open new short.
            // Long:  open first (maintains hedge), then close old long — avoids margin spike on shorts.
            if (request.IsShort)
            {
                await upstox.PlaceOrderV3Async(closeOrder);
                try
                {
                    await upstox.PlaceOrderV3Async(openOrder);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex,
                        "PARTIAL SHIFT — {User} — close {CloseToken} succeeded but open {OpenToken} failed. Manual intervention required.",
                        email, request.InstrumentToken, targetKey);
                    return Results.Problem(
                        $"Close order placed but open order failed: {ex.Message}. Check your positions — manual intervention may be required.");
                }
            }
            else
            {
                await upstox.PlaceOrderV3Async(openOrder);
                try
                {
                    await upstox.PlaceOrderV3Async(closeOrder);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex,
                        "PARTIAL SHIFT — {User} — open {OpenToken} succeeded but close {CloseToken} failed. Manual intervention required.",
                        email, targetKey, request.InstrumentToken);
                    return Results.Problem(
                        $"Open order placed but close order failed: {ex.Message}. Check your positions — manual intervention may be required.");
                }
            }

            logger.LogInformation(
                "Shift {Direction} — {User} — close {CloseToken} qty={Qty} | open {OpenToken} product={Product}",
                request.Direction, email, request.InstrumentToken, request.Qty, targetKey, request.Product);

            return Results.Ok(new { targetToken = targetKey });
        });

        // ── Orders ────────────────────────────────────────────────────────────

        group.MapGet("/orders", async (UpstoxClient upstox) =>
            Results.Ok((await upstox.GetAllOrdersAsync()).Select(o => o.ToResponse())));

        group.MapPost("/orders/v3", async (
            [FromBody] PlaceOrderRequest request,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            var result = await upstox.PlaceOrderV3Async(request);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Order placed — {User} — qty={Qty} {Symbol} {Side} @ {Price} — ids=[{OrderIds}] latency={Latency}ms",
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown",
                request.Quantity, request.InstrumentToken, request.TransactionType, request.Price,
                string.Join(",", result.OrderIds), result.Latency);
            return Results.Ok(result);
        });

        group.MapPost("/orders/cancel-all", async (
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            var ids = await upstox.CancelAllPendingOrdersAsync();
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Cancel all pending orders — {User} — {Count} order(s) cancelled",
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown", ids.Count);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapDelete("/orders/{orderId}/v3", async (
            string orderId,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            ILoggerFactory lf) =>
        {
            var (id, latency) = await upstox.CancelOrderV3Async(orderId);
            lf.CreateLogger("UpstoxEndpoints").LogInformation(
                "Order cancelled — {User} — {OrderId} — latency {Latency}ms",
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown", id, latency);
            return Results.Ok(new { OrderId = id, Latency = latency });
        });

        // ── Funds ─────────────────────────────────────────────────────────────

        group.MapGet("/funds", async (UpstoxClient upstox, CancellationToken ct) =>
        {
            try
            {
                var funds = await upstox.GetFundsAsync(ct);
                return Results.Ok(new
                {
                    availableMargin = funds.AvailableMargin,
                    usedMargin      = funds.UsedMargin,
                    payinAmount     = funds.PayinAmount,
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
                new MarginOrderItem(i.InstrumentToken, i.Quantity, i.Product, i.TransactionType));
            var margin = await upstox.GetRequiredMarginAsync(items);
            return Results.Ok(new { requiredMargin = margin.RequiredMargin, finalMargin = margin.FinalMargin });
        });
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
