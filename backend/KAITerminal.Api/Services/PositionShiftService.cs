using KAITerminal.Api.Models;
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
/// Short positions: close first (releases margin), then open.
/// Long positions: open first (maintains hedge), then close.
/// </summary>
internal sealed class PositionShiftService(OptionStrikeService strikeSvc)
{
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

        // Short: close first (buying back releases margin), then open new short.
        // Long:  open first (maintains hedge), then close old long — avoids margin spike on shorts.
        if (request.IsShort)
        {
            await upstox.Hft.PlaceOrderV3Async(closeOrder);
            try
            {
                await upstox.Hft.PlaceOrderV3Async(openOrder);
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
            await upstox.Hft.PlaceOrderV3Async(openOrder);
            try
            {
                await upstox.Hft.PlaceOrderV3Async(closeOrder);
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
    }

    /// <summary>
    /// Shifts a Zerodha option position. Resolves the target trading symbol via the Kite
    /// instrument CSV and places orders via the standard Zerodha order API.
    /// A 1-second delay between close and open is applied for shorts to allow margin to settle.
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

        // Short: close first (buying back releases margin), then open new short.
        //   A 1-second delay gives Zerodha time to settle the close before the margin check
        //   on the new short — without it the open order can be rejected for insufficient margin.
        // Long:  open first (maintains hedge), then close old long — no delay needed since
        //   opening a long does not consume margin in the same way.
        if (request.IsShort)
        {
            await zerodha.Orders.PlaceOrderAsync(closeOrder, ct);
            await Task.Delay(1000, ct);
            try
            {
                await zerodha.Orders.PlaceOrderAsync(openOrder, ct);
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

        return Results.Ok(new { targetToken = $"{match.Exchange}|{match.TradingSymbol}" });
    }

    private static int ComputeStrikeGap(bool isCe, string direction, int gap) =>
        isCe
            ? (direction == "down" ? gap : -gap)
            : (direction == "up"   ? gap : -gap);
}
