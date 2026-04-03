using KAITerminal.Broker;
using KAITerminal.Contracts.Constants;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Http;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaPositionService : IBrokerPositionService
{
    private readonly ZerodhaHttpClient              _http;
    private readonly ILogger<ZerodhaPositionService> _logger;

    public ZerodhaPositionService(ZerodhaHttpClient http, ILogger<ZerodhaPositionService> logger)
    {
        _http   = http;
        _logger = logger;
    }

    public async Task<IReadOnlyList<BrokerPosition>> GetAllPositionsAsync(CancellationToken ct = default)
    {
        var positions = await _http.GetPositionsAsync(ct);
        return positions
            .Where(p => ExchangeConstants.OptionsExchanges.Contains(p.Exchange))
            .Where(p => ExchangeConstants.IndexUnderlyings.Any(idx =>
                p.TradingSymbol.StartsWith(idx, StringComparison.OrdinalIgnoreCase)))
            .ToList()
            .AsReadOnly();
    }

    public async Task<decimal> GetTotalMtmAsync(CancellationToken ct = default)
    {
        var positions = await GetAllPositionsAsync(ct);
        return positions.Sum(p => p.Pnl);
    }

    public async Task<IReadOnlyList<string>> ExitAllPositionsAsync(
        IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default)
    {
        var positions = await GetAllPositionsAsync(ct);
        var open = positions.Where(p => p.Quantity != 0);

        if (exchanges?.Count > 0)
        {
            var set = exchanges.Select(e => e.ToUpperInvariant()).ToHashSet();
            open = open.Where(p => set.Contains(p.Exchange.ToUpperInvariant()));
        }

        var openList = open.ToList();

        // Exit short positions (qty < 0, BUY-to-close) before long positions (qty > 0, SELL-to-close)
        var shorts = openList.Where(p => p.Quantity < 0).ToList();
        var longs  = openList.Where(p => p.Quantity > 0).ToList();

        await Task.WhenAll(shorts.Select(p => _http.PlaceOrderAsync(
            p.TradingSymbol, p.Exchange, "BUY", ZerodhaProductMap.ToKite(p.Product, p.Exchange), "MARKET", Math.Abs(p.Quantity), null, null, ct)));

        await Task.WhenAll(longs.Select(p => _http.PlaceOrderAsync(
            p.TradingSymbol, p.Exchange, "SELL", ZerodhaProductMap.ToKite(p.Product, p.Exchange), "MARKET", Math.Abs(p.Quantity), null, null, ct)));

        return [];
    }

    public async Task<string> ExitPositionAsync(
        string instrumentToken, string product, CancellationToken ct = default)
    {
        var positions = await GetAllPositionsAsync(ct);
        var pos = positions.FirstOrDefault(p =>
            p.InstrumentToken.Equals(instrumentToken, StringComparison.OrdinalIgnoreCase));

        if (pos is null || pos.Quantity == 0) return string.Empty;

        var txType      = PositionHelper.CloseTransactionType(pos.Quantity);
        var quantity    = Math.Abs(pos.Quantity);
        var kiteProduct = ZerodhaProductMap.ToKite(pos.Product, pos.Exchange);
        await _http.PlaceOrderAsync(pos.TradingSymbol, pos.Exchange, txType, kiteProduct, "MARKET", quantity, null, null, ct);
        return string.Empty;
    }

    public async Task ConvertPositionAsync(
        string instrumentToken, string oldProduct, int quantity, CancellationToken ct = default)
    {
        var positions = await GetAllPositionsAsync(ct);
        var pos = positions.FirstOrDefault(p =>
            p.InstrumentToken.Equals(instrumentToken, StringComparison.OrdinalIgnoreCase));

        if (pos is null || pos.Quantity == 0) return;

        var txType   = PositionHelper.ConvertTransactionType(pos.Quantity);
        var kiteOld  = ZerodhaProductMap.ToKite(pos.Product, pos.Exchange);
        var isFo     = pos.Exchange.Equals("NFO", StringComparison.OrdinalIgnoreCase)
                    || pos.Exchange.Equals("BFO", StringComparison.OrdinalIgnoreCase);
        var kiteNew  = kiteOld == "MIS" ? (isFo ? "NRML" : "CNC") : "MIS";

        // position_type = "day"      → position opened today (sits in the day bucket)
        // position_type = "overnight" → carried from a previous session (no trades today)
        // Derived from day_buy_quantity / day_sell_quantity, NOT from the product type.
        var dayNet  = pos.BuyQuantity - pos.SellQuantity;
        var posType = Math.Abs(dayNet) >= Math.Abs(pos.Quantity) ? "day" : "overnight";

        _logger.LogInformation(
            "ConvertPosition — symbol={Symbol} exchange={Exchange} txType={TxType} posType={PosType} oldProduct={Old} newProduct={New} qty={Qty} (raw pos.Product={RawProduct} pos.Quantity={RawQty})",
            pos.TradingSymbol, pos.Exchange, txType, posType, kiteOld, kiteNew, Math.Abs(quantity),
            pos.Product, pos.Quantity);

        await _http.ConvertPositionAsync(
            pos.TradingSymbol, pos.Exchange, txType, posType, kiteOld, kiteNew, Math.Abs(quantity), ct);
    }


}
