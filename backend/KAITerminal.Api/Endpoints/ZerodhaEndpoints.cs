using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
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

        group.MapGet("/auth-url", ([FromQuery] string apiKey) =>
        {
            if (string.IsNullOrWhiteSpace(apiKey))
                return Results.BadRequest(new { error = "apiKey is required." });
            return Results.Ok(new { loginUrl = $"https://kite.zerodha.com/connect/login?api_key={apiKey}&v=3" });
        });

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

            var (accessToken, brokerUserId) = await zerodha.Auth.GenerateTokenWithUserIdAsync(
                request.ApiKey, request.ApiSecret, request.RequestToken, ct: ct);

            var userEmail = ctx.User?.GetEmail() ?? "";

            if (!string.IsNullOrEmpty(userEmail))
            {
                await credentials.UpsertAsync(userEmail, new SaveBrokerCredentialRequest(
                    BrokerName:  BrokerNames.Zerodha,
                    ApiKey:      request.ApiKey,
                    ApiSecret:   request.ApiSecret,
                    AccessToken: accessToken));
                if (!string.IsNullOrEmpty(brokerUserId))
                    await credentials.UpdateBrokerUserIdAsync(userEmail, BrokerNames.Zerodha, brokerUserId);
            }

            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Zerodha access token exchanged and persisted — {User} zerodhaUserId={UserId}", userEmail, brokerUserId);

            return Results.Ok(new { accessToken });
        });

        // ── Positions ─────────────────────────────────────────────────────────

        group.MapGet("/positions", async (
            ZerodhaClient zerodha,
            [FromQuery] string? exchange,
            CancellationToken ct) =>
        {
            var positions = await zerodha.Positions.GetAllPositionsAsync(ct);
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
            await zerodha.Positions.ExitAllPositionsAsync(exchanges, ct);
            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Exit all positions — {User}", user.GetEmail() ?? "unknown");
            return Results.Ok();
        });

        group.MapPost("/positions/{instrumentToken}/convert", async (
            string instrumentToken,
            [FromBody] ZerodhaConvertRequest request,
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            CancellationToken ct) =>
        {
            await zerodha.Positions.ConvertPositionAsync(instrumentToken, request.OldProduct, request.Quantity, ct);
            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Convert position — {User} — {Token} qty={Qty} from {OldProduct}",
                user.GetEmail() ?? "unknown",
                instrumentToken, request.Quantity, request.OldProduct);
            return Results.Ok();
        });

        group.MapPost("/positions/shift", async (
            [FromBody] ShiftPositionRequest request,
            PositionShiftService shiftSvc,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            CancellationToken ct) =>
            await shiftSvc.ShiftZerodhaAsync(
                request, zerodha, zerodhaInstruments,
                user.GetEmail() ?? "unknown", lf.CreateLogger("ZerodhaEndpoints"), ct));

        group.MapPost("/positions/{instrumentToken}/exit", async (
            string instrumentToken,
            ZerodhaClient zerodha,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            [FromQuery] string product = "NRML",
            CancellationToken ct = default) =>
        {
            await zerodha.Positions.ExitPositionAsync(instrumentToken, product, ct);
            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Exit position — {User} — {Token}",
                user.GetEmail() ?? "unknown", instrumentToken);
            return Results.Ok();
        });

        // ── Orders ────────────────────────────────────────────────────────────

        group.MapGet("/orders", async (ZerodhaClient zerodha, CancellationToken ct) =>
            Results.Ok((await zerodha.Orders.GetAllOrdersAsync(ct)).Select(o => o.ToResponse())));

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
                request.Price,
                request.TriggerPrice,
                request.Exchange);
            var orderId = await zerodha.Orders.PlaceOrderAsync(brokerRequest, ct);
            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Order placed — {User} — {Token} qty={Qty} {Side} — order {OrderId}",
                user.GetEmail() ?? "unknown",
                request.InstrumentToken, request.Quantity, request.TransactionType, orderId);
            return Results.Ok(new { orderId });
        });

        group.MapPost("/orders/by-price", async (
            [FromBody] ByPriceOrderRequest request,
            ByPriceOrderService byPriceSvc,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            CancellationToken ct) =>
            await byPriceSvc.PlaceZerodhaAsync(
                request, zerodha, zerodhaInstruments,
                user.GetEmail() ?? "unknown", lf.CreateLogger("ZerodhaEndpoints"), ct));

        // ── Margin ────────────────────────────────────────────────────────────

        group.MapPost("/margin", async (
            [FromBody] MarginRequest request,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            CancellationToken ct) =>
        {
            var contracts = await zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);
            var items = new List<BrokerMarginOrderItem>();
            foreach (var i in request.Instruments)
            {
                var exchangeToken = i.InstrumentToken.Contains('|') ? i.InstrumentToken.Split('|')[1] : i.InstrumentToken;
                var match = contracts.FirstOrDefault(c => c.ExchangeToken == exchangeToken);
                if (match is null) continue;
                items.Add(new BrokerMarginOrderItem($"{match.Exchange}|{match.TradingSymbol}", i.Quantity, i.Product, i.TransactionType));
            }
            var margin = await zerodha.Margin.GetRequiredMarginAsync(items, ct);
            return Results.Ok(new { requiredMargin = margin.RequiredMargin, finalMargin = margin.FinalMargin });
        });

        // ── Funds ─────────────────────────────────────────────────────────────

        group.MapGet("/funds", async (ZerodhaClient zerodha, CancellationToken ct) =>
        {
            try
            {
                var funds = await zerodha.Funds.GetFundsAsync(ct);
                return Results.Ok(new
                {
                    availableMargin = funds.Available,
                    usedMargin      = funds.Used,
                    payinAmount     = funds.Payin,
                });
            }
            catch
            {
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

    private sealed record ZerodhaConvertRequest(string OldProduct, int Quantity);

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
