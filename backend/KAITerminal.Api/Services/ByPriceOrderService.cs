using KAITerminal.Api.Models;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Api.Services;

/// <summary>
/// Places an option order for the strike nearest to a target premium price.
/// </summary>
internal sealed class ByPriceOrderService(OptionStrikeService strikeSvc)
{
    /// <summary>Finds the nearest-to-target strike and places an Upstox HFT v3 order.</summary>
    public async Task<IResult> PlaceUpstoxAsync(
        ByPriceOrderRequest request, UpstoxClient upstox,
        string email, ILogger logger, CancellationToken ct)
    {
        var key = await strikeSvc.FindByPriceAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.TargetPremium, ct);

        if (key is null)
            return Results.Problem("No matching strike found in option chain.");

        var txn = request.TransactionType == "Buy" ? TransactionType.Buy : TransactionType.Sell;
        var product = UpstoxProductMap.ToEnum(request.Product);

        await upstox.Hft.PlaceOrderV3Async(new PlaceOrderRequest
        {
            InstrumentToken = key,
            Quantity        = request.Qty,
            TransactionType = txn,
            Product         = product,
            Slice           = true,
        });

        logger.LogInformation(
            "By-price order — {User} — {Underlying} {Expiry} {Type} qty={Qty} {Side} target=₹{Premium} → {Key}",
            email,
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.Qty, request.TransactionType, request.TargetPremium, key);

        return Results.Ok(new { instrumentKey = key });
    }

    /// <summary>Finds the nearest-to-target strike, resolves the Zerodha trading symbol, and places an order.</summary>
    public async Task<IResult> PlaceZerodhaAsync(
        ByPriceOrderRequest request, ZerodhaClient zerodha,
        IZerodhaInstrumentService zerodhaInstruments,
        string email, ILogger logger, CancellationToken ct)
    {
        var upstoxKey = await strikeSvc.FindByPriceAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.TargetPremium, ct);

        if (upstoxKey is null)
            return Results.Problem("No matching strike found in option chain.");

        var (match, exchangeToken) = await ZerodhaContractResolver.ResolveAsync(upstoxKey, zerodhaInstruments, ct);
        if (match is null)
            return Results.Problem($"Zerodha trading symbol not found for exchange token {exchangeToken}.");

        var brokerRequest = new BrokerOrderRequest(match.TradingSymbol, request.Qty, request.TransactionType, request.Product, "MARKET", Exchange: match.Exchange);
        await zerodha.Orders.PlaceOrderAsync(brokerRequest, ct);

        logger.LogInformation(
            "By-price order — {User} — {Underlying} {Expiry} {Type} qty={Qty} {Side} target=₹{Premium} → {Symbol} ({Exchange})",
            email,
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.Qty, request.TransactionType, request.TargetPremium, match.TradingSymbol, match.Exchange);

        return Results.Ok(new { instrumentKey = upstoxKey });
    }
}
