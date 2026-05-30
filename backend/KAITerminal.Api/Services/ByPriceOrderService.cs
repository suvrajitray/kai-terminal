using KAITerminal.Api.Models;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.OrderRouting;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Api.Services;

internal sealed class ByPriceOrderService(OptionStrikeService strikeSvc)
{
    public async Task<IResult> PlaceUpstoxAsync(
        ByPriceOrderRequest request, UpstoxClient upstox,
        string email, ILogger logger, CancellationToken ct,
        IOrderRouter? orderRouter = null)
    {
        var key = await strikeSvc.FindByPriceAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.TargetPremium, ct);

        if (key is null)
            return Results.Problem("No matching strike found in option chain.");

        var txn     = request.TransactionType == "Buy" ? TransactionType.Buy : TransactionType.Sell;
        var product = UpstoxProductMap.ToEnum(request.Product);
        var orderRequest = new PlaceOrderRequest
        {
            InstrumentToken = key,
            Quantity        = request.Qty,
            TransactionType = txn,
            Product         = product,
            Slice           = true,
        };

        if (orderRouter is not null)
            await orderRouter.PlaceUpstoxOrderAsync(email, UpstoxTokenContext.Current!, orderRequest, ct);
        else
            await upstox.Hft.PlaceOrderV3Async(orderRequest);

        logger.LogInformation(
            "By-price order — {User} — {Underlying} {Expiry} {Type} qty={Qty} {Side} target=₹{Premium} → {Key}",
            email, request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.Qty, request.TransactionType, request.TargetPremium, key);

        return Results.Ok(new { instrumentKey = key });
    }

    public async Task<IResult> PlaceZerodhaAsync(
        ByPriceOrderRequest request, ZerodhaClient zerodha,
        IZerodhaInstrumentService zerodhaInstruments,
        string email, ILogger logger, CancellationToken ct,
        IOrderRouter? orderRouter = null)
    {
        var upstoxKey = await strikeSvc.FindByPriceAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.TargetPremium, ct);

        if (upstoxKey is null)
            return Results.Problem("No matching strike found in option chain.");

        var (match, exchangeToken) = await ZerodhaContractResolver.ResolveAsync(upstoxKey, zerodhaInstruments, ct);
        if (match is null)
            return Results.Problem($"Zerodha trading symbol not found for exchange token {exchangeToken}.");

        var brokerRequest = new BrokerOrderRequest(
            match.TradingSymbol, request.Qty, request.TransactionType,
            request.Product, "MARKET", Exchange: match.Exchange);

        if (orderRouter is not null)
        {
            var creds = ZerodhaTokenContext.Current!.Value;
            await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, brokerRequest, ct);
        }
        else
            await zerodha.Orders.PlaceOrderAsync(brokerRequest, ct);

        logger.LogInformation(
            "By-price order — {User} — {Underlying} {Expiry} {Type} qty={Qty} {Side} target=₹{Premium} → {Symbol} ({Exchange})",
            email, request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.Qty, request.TransactionType, request.TargetPremium, match.TradingSymbol, match.Exchange);

        return Results.Ok(new { instrumentKey = upstoxKey });
    }
}
