using System.Security.Claims;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Options;
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

            var accessToken = await zerodha.Auth.GenerateTokenAsync(
                request.ApiKey, request.ApiSecret, request.RequestToken, ct: ct);

            var userEmail = ctx.User.FindFirst(
                System.Security.Claims.ClaimTypes.Email)?.Value ?? "";

            if (!string.IsNullOrEmpty(userEmail))
            {
                await credentials.UpsertAsync(userEmail, new SaveBrokerCredentialRequest(
                    BrokerName:  BrokerNames.Zerodha,
                    ApiKey:      request.ApiKey,
                    ApiSecret:   request.ApiSecret,
                    AccessToken: accessToken));
            }

            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Zerodha access token exchanged and persisted — {User}", userEmail);

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
                "Exit all positions — {User}", user.FindFirstValue(ClaimTypes.Email) ?? "unknown");
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
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown",
                instrumentToken, request.Quantity, request.OldProduct);
            return Results.Ok();
        });

        group.MapPost("/positions/shift", async (
            [FromBody] ShiftPositionRequest request,
            OptionStrikeService strikeSvc,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            CancellationToken ct) =>
        {
            bool isCe = OptionInstrumentType.IsCe(request.InstrumentType);
            var strikeGap = isCe
                ? (request.Direction == "down" ? request.StrikeGap : -request.StrikeGap)
                : (request.Direction == "up"   ? request.StrikeGap : -request.StrikeGap);
            var upstoxKey = await strikeSvc.FindByStrikeGapAsync(
                request.UnderlyingKey, request.Expiry, request.InstrumentType,
                request.CurrentStrike, strikeGap, ct);

            if (upstoxKey is null)
                return Results.Problem("No matching strike found in option chain.");

            var exchangeToken = upstoxKey.Contains('|') ? upstoxKey.Split('|')[1] : upstoxKey;
            var contracts     = await zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);
            var match         = contracts.FirstOrDefault(c => c.ExchangeToken == exchangeToken);

            if (match is null)
                return Results.Problem($"Zerodha trading symbol not found for exchange token {exchangeToken}.");

            var closeToken = string.IsNullOrEmpty(request.Exchange)
                ? request.InstrumentToken
                : $"{request.Exchange}|{request.InstrumentToken}";
            var openToken  = $"{match.Exchange}|{match.TradingSymbol}";

            var closeTxn = request.IsShort ? "Buy"  : "Sell";
            var openTxn  = request.IsShort ? "Sell" : "Buy";

            var closeOrder = new BrokerOrderRequest(closeToken, request.Qty, closeTxn, request.Product, "MARKET");
            var openOrder  = new BrokerOrderRequest(openToken,  request.Qty, openTxn,  request.Product, "MARKET");

            var logger = lf.CreateLogger("ZerodhaEndpoints");
            var email  = user.FindFirstValue(ClaimTypes.Email) ?? "unknown";

            // Short: close first (buying back releases margin), then open new short.
            // Long:  open first (maintains hedge), then close old long — avoids margin spike on shorts.
            if (request.IsShort)
            {
                await zerodha.Orders.PlaceOrderAsync(closeOrder, ct);
                try
                {
                    await zerodha.Orders.PlaceOrderAsync(openOrder, ct);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex,
                        "PARTIAL SHIFT — {User} — close {CloseToken} succeeded but open {OpenToken} failed. Manual intervention required.",
                        email, closeToken, openToken);
                    return Results.Problem(
                        $"Close order placed but open order failed: {ex.Message}. Check your positions — manual intervention may be required.");
                }
            }
            else
            {
                await zerodha.Orders.PlaceOrderAsync(openOrder, ct);
                try
                {
                    await zerodha.Orders.PlaceOrderAsync(closeOrder, ct);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex,
                        "PARTIAL SHIFT — {User} — open {OpenToken} succeeded but close {CloseToken} failed. Manual intervention required.",
                        email, openToken, closeToken);
                    return Results.Problem(
                        $"Open order placed but close order failed: {ex.Message}. Check your positions — manual intervention may be required.");
                }
            }

            logger.LogInformation(
                "Shift {Direction} — {User} — close {CloseToken} qty={Qty} | open {OpenToken} product={Product}",
                request.Direction, email, closeToken, request.Qty, openToken, request.Product);

            return Results.Ok(new { targetToken = openToken });
        });

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
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown", instrumentToken);
            return Results.Ok();
        });

        // ── Orders ────────────────────────────────────────────────────────────

        group.MapGet("/orders", async (ZerodhaClient zerodha, CancellationToken ct) =>
            Results.Ok(await zerodha.Orders.GetAllOrdersAsync(ct)));

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
            var orderId = await zerodha.Orders.PlaceOrderAsync(brokerRequest, ct);
            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "Order placed — {User} — {Token} qty={Qty} {Side} — order {OrderId}",
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown",
                request.InstrumentToken, request.Quantity, request.TransactionType, orderId);
            return Results.Ok(new { orderId });
        });

        group.MapPost("/orders/by-price", async (
            [FromBody] ByPriceOrderRequest request,
            OptionStrikeService strikeSvc,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            ClaimsPrincipal user,
            ILoggerFactory lf,
            CancellationToken ct) =>
        {
            var upstoxKey = await strikeSvc.FindByPriceAsync(
                request.UnderlyingKey, request.Expiry, request.InstrumentType,
                request.TargetPremium, ct);

            if (upstoxKey is null)
                return Results.Problem("No matching strike found in option chain.");

            var exchangeToken = upstoxKey.Contains('|') ? upstoxKey.Split('|')[1] : upstoxKey;
            var contracts     = await zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);
            var match         = contracts.FirstOrDefault(c => c.ExchangeToken == exchangeToken);

            if (match is null)
                return Results.Problem($"Zerodha trading symbol not found for exchange token {exchangeToken}.");

            var orderToken = $"{match.Exchange}|{match.TradingSymbol}";
            var brokerRequest = new BrokerOrderRequest(orderToken, request.Qty, request.TransactionType, request.Product, "MARKET");
            await zerodha.Orders.PlaceOrderAsync(brokerRequest, ct);

            lf.CreateLogger("ZerodhaEndpoints").LogInformation(
                "By-price order — {User} — {Underlying} {Expiry} {Type} qty={Qty} {Side} target=₹{Premium} → {Token}",
                user.FindFirstValue(ClaimTypes.Email) ?? "unknown",
                request.UnderlyingKey, request.Expiry, request.InstrumentType,
                request.Qty, request.TransactionType, request.TargetPremium, orderToken);

            return Results.Ok(new { instrumentKey = upstoxKey });
        });

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
        decimal? Price = null);

}
