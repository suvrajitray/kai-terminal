using KAITerminal.Api.Models;
using KAITerminal.Broker;
using KAITerminal.Contracts.Options;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Api.Services;

/// <summary>
/// Executes broker position shifts: closes the current option position and opens
/// a new one one strike further OTM in the requested direction.
/// Short positions: close first (releases margin), then poll until filled, then open.
/// Long positions: open first (maintains hedge), then close.
/// </summary>
internal sealed class PositionShiftService(OptionStrikeService strikeSvc)
{
    private const int FillTimeoutSeconds = 20;

    /// <summary>Shifts an Upstox option position using the HFT v3 order API.</summary>
    public async Task<IResult> ShiftUpstoxAsync(
        ShiftPositionRequest request, UpstoxClient upstox,
        string email, ILogger logger, CancellationToken ct)
    {
        bool isCe = OptionInstrumentType.IsCe(request.InstrumentType);
        var strikeGap = ComputeStrikeGap(isCe, request.Direction, request.StrikeGap);
        var targetKey = await strikeSvc.FindByStrikeGapAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.CurrentStrike, strikeGap, ct);

        if (targetKey is null)
            return Results.Problem("No matching strike found in option chain.");

        var closeTxn = request.IsShort ? TransactionType.Buy  : TransactionType.Sell;
        var openTxn  = request.IsShort ? TransactionType.Sell : TransactionType.Buy;
        var product = UpstoxProductMap.ToEnum(request.Product);

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

        // Short: close first (buying back releases margin), wait for fill, then open new short.
        //   CancellationToken.None for the poll and open leg is intentional — the close order
        //   is already at the exchange, so we must complete the open regardless of request cancellation.
        // Long:  open first (maintains hedge), then close old long.
        string? warning = null;
        if (request.IsShort)
        {
            var closeResult = await upstox.Hft.PlaceOrderV3Async(closeOrder, ct);
            var closeOrderIds = string.Join(",", closeResult.OrderIds);
            var filled = await WaitForFillAsync(upstox.Orders, closeOrderIds, FillTimeoutSeconds, logger, CancellationToken.None);
            if (!filled)
                warning = "Close order fill not confirmed within 20s — open leg placed anyway. Verify your positions.";
            try
            {
                await upstox.Hft.PlaceOrderV3Async(openOrder, CancellationToken.None);
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
            await upstox.Hft.PlaceOrderV3Async(openOrder, ct);
            try
            {
                await upstox.Hft.PlaceOrderV3Async(closeOrder, ct);
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

        return Results.Ok(new { targetToken = targetKey, warning });
    }

    /// <summary>
    /// Shifts a Zerodha option position. Resolves the target trading symbol via the Kite
    /// instrument CSV and places orders via the standard Zerodha order API.
    /// For shorts, polls until the close order fills before placing the open order.
    /// </summary>
    public async Task<IResult> ShiftZerodhaAsync(
        ShiftPositionRequest request, ZerodhaClient zerodha,
        IZerodhaInstrumentService zerodhaInstruments,
        string email, ILogger logger, CancellationToken ct)
    {
        bool isCe = OptionInstrumentType.IsCe(request.InstrumentType);
        var strikeGap = ComputeStrikeGap(isCe, request.Direction, request.StrikeGap);
        var upstoxKey = await strikeSvc.FindByStrikeGapAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.CurrentStrike, strikeGap, ct);

        if (upstoxKey is null)
            return Results.Problem("No matching strike found in option chain.");

        var (match, exchangeToken) = await ZerodhaContractResolver.ResolveAsync(upstoxKey, zerodhaInstruments, ct);
        if (match is null)
            return Results.Problem($"Zerodha trading symbol not found for exchange token {exchangeToken}.");

        var closeTxn = request.IsShort ? "Buy"  : "Sell";
        var openTxn  = request.IsShort ? "Sell" : "Buy";

        var closeOrder = new BrokerOrderRequest(request.InstrumentToken, request.Qty, closeTxn, request.Product, "MARKET", Exchange: request.Exchange);
        var openOrder  = new BrokerOrderRequest(match.TradingSymbol,     request.Qty, openTxn,  request.Product, "MARKET", Exchange: match.Exchange);

        // Short: close first (buying back releases margin), poll until fill, then open new short.
        //   Polling replaces the old fixed 1-second delay — the open is placed only once the
        //   exchange confirms the close fill, eliminating margin-rejection on the open leg.
        //   CancellationToken.None for the poll and open leg is intentional — the close order
        //   is already at the exchange, so we must complete the open regardless of request cancellation.
        // Long:  open first (maintains hedge), then close old long.
        string? warning = null;
        if (request.IsShort)
        {
            var closeOrderId = await zerodha.Orders.PlaceOrderAsync(closeOrder, ct);
            var filled = await WaitForFillAsync(zerodha.Orders, closeOrderId, FillTimeoutSeconds, logger, CancellationToken.None);
            if (!filled)
                warning = "Close order fill not confirmed within 20s — open leg placed anyway. Verify your positions.";
            try
            {
                await zerodha.Orders.PlaceOrderAsync(openOrder, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "PARTIAL SHIFT — {User} — close {CloseSymbol} succeeded but open {OpenSymbol} failed. Manual intervention required.",
                    email, request.InstrumentToken, match.TradingSymbol);
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
                    "PARTIAL SHIFT — {User} — open {OpenSymbol} succeeded but close {CloseSymbol} failed. Manual intervention required.",
                    email, match.TradingSymbol, request.InstrumentToken);
                return Results.Problem(
                    $"Open order placed but close order failed: {ex.Message}. Check your positions — manual intervention may be required.");
            }
        }

        logger.LogInformation(
            "Shift {Direction} — {User} — close {CloseSymbol} ({CloseExchange}) qty={Qty} | open {OpenSymbol} ({OpenExchange}) product={Product}",
            request.Direction, email, request.InstrumentToken, request.Exchange, request.Qty, match.TradingSymbol, match.Exchange, request.Product);

        return Results.Ok(new { targetToken = $"{match.Exchange}|{match.TradingSymbol}", warning });
    }

    /// <summary>
    /// Polls the order book until all order IDs reach "complete" status or the timeout elapses.
    /// Throws <see cref="InvalidOperationException"/> if any order is rejected.
    /// On timeout, logs a warning and returns so the open leg can still be attempted.
    /// </summary>
    /// <returns>True if all orders filled; false if the timeout elapsed before confirmation.</returns>
    private static async Task<bool> WaitForFillAsync(
        IBrokerOrderService orders, string orderIds, int timeoutSeconds,
        ILogger logger, CancellationToken ct)
    {
        var ids = orderIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                          .ToHashSet(StringComparer.Ordinal);
        var deadline = DateTimeOffset.UtcNow.AddSeconds(timeoutSeconds);

        while (DateTimeOffset.UtcNow < deadline)
        {
            var allOrders = await orders.GetAllOrdersAsync(ct);
            var matched   = allOrders.Where(o => ids.Contains(o.OrderId)).ToList();

            var rejected = matched.FirstOrDefault(o =>
                o.Status.Equals("rejected", StringComparison.OrdinalIgnoreCase));
            if (rejected is not null)
                throw new InvalidOperationException(
                    $"Close order {rejected.OrderId} was rejected: {rejected.StatusMessage}");

            if (matched.Count > 0 &&
                matched.All(o => o.Status.Equals("complete", StringComparison.OrdinalIgnoreCase)))
                return true;

            await Task.Delay(500, ct);
        }

        logger.LogWarning(
            "Shift: timed out after {Timeout}s waiting for close fill — orderIds={OrderIds} — proceeding with open leg anyway",
            timeoutSeconds, orderIds);
        return false;
    }

    private static int ComputeStrikeGap(bool isCe, string direction, int gap) =>
        isCe
            ? (direction == "down" ? gap : -gap)
            : (direction == "up"   ? gap : -gap);
}
