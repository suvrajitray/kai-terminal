using KAITerminal.Api.Models;
using KAITerminal.Broker;
using KAITerminal.Contracts.Options;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.OrderRouting;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Api.Services;

internal sealed class PositionShiftService(OptionStrikeService strikeSvc)
{
    private const int FillTimeoutSeconds = 20;

    public async Task<IResult> ShiftUpstoxAsync(
        ShiftPositionRequest request, UpstoxClient upstox,
        IOrderRouter orderRouter, string email, ILogger logger, CancellationToken ct)
    {
        bool isCe      = OptionInstrumentType.IsCe(request.InstrumentType);
        var  strikeGap = ComputeStrikeGap(isCe, request.Direction, request.StrikeGap);
        var  targetKey = await strikeSvc.FindByStrikeGapAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.CurrentStrike, strikeGap, ct);

        if (targetKey is null)
            return Results.Problem("No matching strike found in option chain.");

        var closeTxn = request.IsShort ? TransactionType.Buy  : TransactionType.Sell;
        var openTxn  = request.IsShort ? TransactionType.Sell : TransactionType.Buy;
        var product  = UpstoxProductMap.ToEnum(request.Product);
        var token    = UpstoxTokenContext.Current!;

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

        string? warning = null;
        if (request.IsShort)
        {
            var closeResult   = await orderRouter.PlaceUpstoxOrderAsync(email, token, closeOrder, ct);
            var closeOrderIds = string.Join(",", closeResult.OrderIds);
            var filled = await WaitForFillAsync(upstox.Orders, closeOrderIds, FillTimeoutSeconds, logger, CancellationToken.None);
            if (!filled)
                warning = "Close order fill not confirmed within 20s — open leg placed anyway. Verify your positions.";
            try
            {
                await orderRouter.PlaceUpstoxOrderAsync(email, token, openOrder, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "PARTIAL SHIFT — {User} — close {CloseToken} succeeded but open {OpenToken} failed.",
                    email, request.InstrumentToken, targetKey);
                return Results.Problem(
                    $"Close order placed but open order failed: {ex.Message}. Manual intervention may be required.");
            }
        }
        else
        {
            await orderRouter.PlaceUpstoxOrderAsync(email, token, openOrder, ct);
            try
            {
                await orderRouter.PlaceUpstoxOrderAsync(email, token, closeOrder, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "PARTIAL SHIFT — {User} — open {OpenToken} succeeded but close {CloseToken} failed.",
                    email, targetKey, request.InstrumentToken);
                return Results.Problem(
                    $"Open order placed but close order failed: {ex.Message}. Manual intervention may be required.");
            }
        }

        logger.LogInformation(
            "Shift {Direction} — {User} — close {CloseToken} qty={Qty} | open {OpenToken} product={Product}",
            request.Direction, email, request.InstrumentToken, request.Qty, targetKey, request.Product);

        return Results.Ok(new { targetToken = targetKey, warning });
    }

    public async Task<IResult> ShiftZerodhaAsync(
        ShiftPositionRequest request, ZerodhaClient zerodha,
        IZerodhaInstrumentService zerodhaInstruments,
        IOrderRouter orderRouter, string email, ILogger logger, CancellationToken ct)
    {
        bool isCe      = OptionInstrumentType.IsCe(request.InstrumentType);
        var  strikeGap = ComputeStrikeGap(isCe, request.Direction, request.StrikeGap);
        var  upstoxKey = await strikeSvc.FindByStrikeGapAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.CurrentStrike, strikeGap, ct);

        if (upstoxKey is null)
            return Results.Problem("No matching strike found in option chain.");

        var (match, exchangeToken) = await ZerodhaContractResolver.ResolveAsync(upstoxKey, zerodhaInstruments, ct);
        if (match is null)
            return Results.Problem($"Zerodha trading symbol not found for exchange token {exchangeToken}.");

        var closeTxn   = request.IsShort ? "Buy"  : "Sell";
        var openTxn    = request.IsShort ? "Sell" : "Buy";
        var creds      = ZerodhaTokenContext.Current!.Value;
        var closeOrder = new BrokerOrderRequest(request.InstrumentToken, request.Qty, closeTxn, request.Product, "MARKET", Exchange: request.Exchange);
        var openOrder  = new BrokerOrderRequest(match.TradingSymbol, request.Qty, openTxn, request.Product, "MARKET", Exchange: match.Exchange);

        string? warning = null;
        if (request.IsShort)
        {
            var closeOrderId = await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, closeOrder, ct);
            var filled = await WaitForFillAsync(zerodha.Orders, closeOrderId, FillTimeoutSeconds, logger, CancellationToken.None);
            if (!filled)
                warning = "Close order fill not confirmed within 20s — open leg placed anyway. Verify your positions.";
            try
            {
                await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, openOrder, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "PARTIAL SHIFT — {User} — close {CloseSymbol} succeeded but open {OpenSymbol} failed.",
                    email, request.InstrumentToken, match.TradingSymbol);
                return Results.Problem(
                    $"Close order placed but open order failed: {ex.Message}. Manual intervention may be required.");
            }
        }
        else
        {
            await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, openOrder, ct);
            try
            {
                await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, closeOrder, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "PARTIAL SHIFT — {User} — open {OpenSymbol} succeeded but close {CloseSymbol} failed.",
                    email, match.TradingSymbol, request.InstrumentToken);
                return Results.Problem(
                    $"Open order placed but close order failed: {ex.Message}. Manual intervention may be required.");
            }
        }

        logger.LogInformation(
            "Shift {Direction} — {User} — close {CloseSymbol} ({CloseExchange}) qty={Qty} | open {OpenSymbol} ({OpenExchange}) product={Product}",
            request.Direction, email, request.InstrumentToken, request.Exchange, request.Qty,
            match.TradingSymbol, match.Exchange, request.Product);

        return Results.Ok(new { targetToken = $"{match.Exchange}|{match.TradingSymbol}", warning });
    }

    private static async Task<bool> WaitForFillAsync(
        IBrokerOrderService orders, string orderIds, int timeoutSeconds,
        ILogger logger, CancellationToken ct)
    {
        var ids      = orderIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.Ordinal);
        var deadline = DateTimeOffset.UtcNow.AddSeconds(timeoutSeconds);

        while (DateTimeOffset.UtcNow < deadline)
        {
            var allOrders = await orders.GetAllOrdersAsync(ct);
            var matched   = allOrders.Where(o => ids.Contains(o.OrderId)).ToList();

            var rejected = matched.FirstOrDefault(o => o.Status.Equals("rejected", StringComparison.OrdinalIgnoreCase));
            if (rejected is not null)
                throw new InvalidOperationException($"Close order {rejected.OrderId} was rejected: {rejected.StatusMessage}");

            if (matched.Count > 0 && matched.All(o => o.Status.Equals("complete", StringComparison.OrdinalIgnoreCase)))
                return true;

            await Task.Delay(500, ct);
        }

        logger.LogWarning(
            "Shift: timed out after {Timeout}s waiting for close fill — orderIds={OrderIds}",
            timeoutSeconds, orderIds);
        return false;
    }

    private static int ComputeStrikeGap(bool isCe, string direction, int gap) =>
        isCe ? (direction == "down" ? gap : -gap)
             : (direction == "up"   ? gap : -gap);
}
