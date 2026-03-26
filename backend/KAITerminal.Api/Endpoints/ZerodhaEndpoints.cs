using System.Security.Claims;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.Api.Endpoints;

public static class ZerodhaEndpoints
{
    public static void MapZerodhaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/zerodha").RequireAuthorization();

        // ── Auth ──────────────────────────────────────────────────────────────

        /// <summary>Returns the Kite Connect login URL for the given api_key.</summary>
        group.MapGet("/auth-url", (
            [FromQuery] string apiKey,
            ZerodhaClient zerodha) =>
        {
            if (string.IsNullOrWhiteSpace(apiKey))
                return Results.BadRequest(new { error = "apiKey is required." });
            return Results.Ok(new { loginUrl = zerodha.GetLoginUrl(apiKey) });
        });

        /// <summary>
        /// Exchanges a Kite <c>request_token</c> (returned in the OAuth callback) for a daily
        /// <c>access_token</c>. Optionally persists the token to BrokerCredentials.
        /// </summary>
        group.MapPost("/access-token", async (
            [FromBody] ZerodhaTokenRequest request,
            ZerodhaClient zerodha,
            BrokerCredentialService credentials,
            HttpContext ctx,
            ILoggerFactory lf,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.ApiKey)
                || string.IsNullOrWhiteSpace(request.ApiSecret)
                || string.IsNullOrWhiteSpace(request.RequestToken))
            {
                return Results.BadRequest(new
                {
                    error = "apiKey, apiSecret, and requestToken are required."
                });
            }

            var accessToken = await zerodha.ExchangeTokenAsync(
                request.ApiKey, request.ApiSecret, request.RequestToken, ct);

            // Persist to DB (upsert) so the risk Worker can pick it up on next tick
            var userEmail = ctx.User.FindFirst(
                System.Security.Claims.ClaimTypes.Email)?.Value ?? "";

            if (!string.IsNullOrEmpty(userEmail))
            {
                await credentials.UpsertAsync(userEmail, new SaveBrokerCredentialRequest(
                    BrokerName:  "zerodha",
                    ApiKey:      request.ApiKey,
                    ApiSecret:   request.ApiSecret,
                    AccessToken: accessToken));
            }

            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Zerodha access token exchanged and persisted — {User}", userEmail);

            return Results.Ok(new { accessToken });
        });

        // ── Positions ─────────────────────────────────────────────────────────

        /// <summary>Returns net positions, optionally filtered by a comma-separated exchange list.</summary>
        group.MapGet("/positions", async (
            ZerodhaClient zerodha,
            [FromQuery] string? exchange,
            CancellationToken ct) =>
        {
            var positions = await zerodha.GetAllPositionsAsync(ct);
            if (!string.IsNullOrWhiteSpace(exchange))
            {
                var exchanges = exchange.Split(',')
                    .Select(e => e.Trim().ToUpperInvariant())
                    .ToHashSet();
                positions = positions
                    .Where(p => exchanges.Contains(p.Exchange.ToUpperInvariant()))
                    .ToList();
            }
            return Results.Ok(positions.Select(p => p.ToResponse()));
        });

        group.MapPost("/positions/exit-all", async (
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            [FromQuery] string? exchange = null,
            CancellationToken ct = default) =>
        {
            var exchanges = string.IsNullOrWhiteSpace(exchange)
                ? null
                : exchange.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                          .ToList()
                          .AsReadOnly();
            await zerodha.ExitAllPositionsAsync(exchanges, ct);
            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Exit all positions — {User}", user.FindFirstValue(ClaimTypes.Email) ?? "unknown");
            return Results.Ok();
        });

        group.MapPost("/positions/{instrumentToken}/exit", async (
            string instrumentToken,
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            [FromQuery] string product = "NRML",
            CancellationToken ct = default) =>
        {
            await zerodha.ExitPositionAsync(instrumentToken, product, ct);
            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Exit position — {User} — {Token}",
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown", instrumentToken);
            return Results.Ok();
        });

        // ── Orders ────────────────────────────────────────────────────────────

        group.MapGet("/orders", async (ZerodhaClient zerodha, CancellationToken ct) =>
            Results.Ok(await zerodha.GetAllOrdersAsync(ct)));

        group.MapPost("/orders/v3", async (
            [FromBody] ZerodhaOrderRequest request,
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            CancellationToken ct) =>
        {
            var brokerRequest = new BrokerOrderRequest(
                request.InstrumentToken,
                request.Quantity,
                request.TransactionType,
                request.Product,
                request.OrderType,
                request.Price);
            var orderId = await zerodha.PlaceOrderAsync(brokerRequest, ct);
            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Order placed — {User} — {Token} qty={Qty} {Side} — order {OrderId}",
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown",
                request.InstrumentToken, request.Quantity, request.TransactionType, orderId);
            return Results.Ok(new { orderId });
        });

        // ── Margin ────────────────────────────────────────────────────────────

        /// <summary>Calculates required margin for a basket of hypothetical Zerodha orders.</summary>
        group.MapPost("/margin", async (
            [FromBody] ZerodhaMarginRequest request,
            ZerodhaClient zerodha,
            CancellationToken ct) =>
        {
            var items = request.Instruments.Select(i =>
                new ZerodhaMarginOrderItem(i.TradingSymbol, i.Exchange, i.TransactionType, i.Product, i.Quantity));
            var margin = await zerodha.GetRequiredMarginAsync(items, ct);
            return Results.Ok(new { requiredMargin = margin.RequiredMargin, finalMargin = margin.FinalMargin });
        });

        // ── Funds ─────────────────────────────────────────────────────────────

        /// <summary>Returns available and used margin for the Zerodha equity/F&amp;O segment.</summary>
        group.MapGet("/funds", async (ZerodhaClient zerodha, CancellationToken ct) =>
        {
            try
            {
                var funds = await zerodha.GetFundsAsync(ct);
                return Results.Ok(new
                {
                    availableMargin = funds.Available,
                    usedMargin      = funds.Used,
                    payinAmount     = funds.Payin,
                });
            }
            catch
            {
                // Return null fields if funds API is unavailable (same pattern as Upstox endpoint)
                return Results.Ok(new
                {
                    availableMargin = (decimal?)null,
                    usedMargin      = (decimal?)null,
                    payinAmount     = (decimal?)null,
                });
            }
        });
    }

    private sealed record ZerodhaTokenRequest(
        string ApiKey,
        string ApiSecret,
        string RequestToken);

    private sealed record ZerodhaOrderRequest(
        string   InstrumentToken,
        int      Quantity,
        string   TransactionType,
        string   Product,
        string   OrderType,
        decimal? Price = null);

    private sealed record ZerodhaMarginRequest(
        IReadOnlyList<ZerodhaMarginInstrument> Instruments);

    private sealed record ZerodhaMarginInstrument(
        string TradingSymbol,
        string Exchange,
        string TransactionType,
        string Product,
        int    Quantity);
}
