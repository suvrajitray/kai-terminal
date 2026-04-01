using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Constants;
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox.Exceptions;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;

namespace KAITerminal.Upstox.Services;

internal sealed class UpstoxPositionService : IBrokerPositionService
{
    private readonly UpstoxHttpClient _http;

    public UpstoxPositionService(UpstoxHttpClient http)
    {
        _http = http;
    }

    public async Task<IReadOnlyList<BrokerPosition>> GetAllPositionsAsync(CancellationToken ct = default)
    {
        var raw = await _http.GetPositionsAsync(ct);
        return raw
            .Where(p => ExchangeConstants.OptionsExchanges.Contains(p.Exchange))
            .Select(Map)
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
        var open = positions.Where(p => p.IsOpen);

        if (exchanges?.Count > 0)
        {
            var set = exchanges.Select(e => e.ToUpperInvariant()).ToHashSet();
            open = open.Where(p => set.Contains(p.Exchange.ToUpperInvariant()));
        }

        var openList = open.ToList();
        if (openList.Count == 0)
            return [];

        // Exit shorts (BUY-to-close) before longs (SELL-to-close) to reduce risk exposure first
        var shorts = openList.Where(p => p.Quantity < 0).ToList();
        var longs  = openList.Where(p => p.Quantity > 0).ToList();

        var shortResults = await Task.WhenAll(shorts.Select(p => ExitSingleAsync(p, ct)));
        var longResults  = await Task.WhenAll(longs.Select(p => ExitSingleAsync(p, ct)));

        return shortResults.Concat(longResults).ToList().AsReadOnly();
    }

    public async Task<string> ExitPositionAsync(
        string instrumentToken, string product, CancellationToken ct = default)
    {
        var positions = await GetAllPositionsAsync(ct);
        var position = positions.FirstOrDefault(p =>
            string.Equals(p.InstrumentToken, instrumentToken, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(p.Product, product, StringComparison.OrdinalIgnoreCase));

        if (position is null)
            throw new UpstoxException($"Position not found for instrument token: {instrumentToken}, product: {product}");

        if (!position.IsOpen)
            throw new UpstoxException($"Position for {instrumentToken}/{product} is already closed (quantity = 0).");

        return await ExitSingleAsync(position, ct);
    }

    public async Task ConvertPositionAsync(
        string instrumentToken, string oldProduct, int quantity, CancellationToken ct = default)
    {
        var positions = await GetAllPositionsAsync(ct);
        var position = positions.FirstOrDefault(p =>
            string.Equals(p.InstrumentToken, instrumentToken, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(p.Product, oldProduct, StringComparison.OrdinalIgnoreCase));

        if (position is null)
            throw new UpstoxException($"Position not found for instrument token: {instrumentToken}, product: {oldProduct}");

        if (!position.IsOpen)
            throw new UpstoxException($"Position for {instrumentToken}/{oldProduct} is already closed (quantity = 0).");

        var newProduct      = string.Equals(oldProduct, "I", StringComparison.OrdinalIgnoreCase) ? "D" : "I";
        var transactionType = PositionHelper.ConvertTransactionType(position.Quantity);

        await _http.ConvertPositionAsync(instrumentToken, oldProduct.ToUpperInvariant(), newProduct, transactionType, quantity, ct);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task<string> ExitSingleAsync(BrokerPosition position, CancellationToken ct)
    {
        var txStr  = PositionHelper.CloseTransactionType(position.Quantity);
        var txType = txStr == "SELL" ? TransactionType.Sell : TransactionType.Buy;

        var request = new PlaceOrderRequest
        {
            InstrumentToken = position.InstrumentToken,
            Quantity        = Math.Abs(position.Quantity),
            TransactionType = txType,
            OrderType       = OrderType.Market,
            Product         = UpstoxProductMap.ToEnum(position.Product),
            Tag             = "EXIT"
        };

        var result = await _http.PlaceOrderV3Async(request, ct);
        return result.OrderIds.FirstOrDefault()!;
    }

    private static BrokerPosition Map(Models.Responses.Position p) => new()
    {
        Exchange        = p.Exchange,
        InstrumentToken = p.InstrumentToken,
        TradingSymbol   = p.TradingSymbol,
        Product         = p.Product,
        Quantity        = p.Quantity,
        BuyQuantity     = p.DayBuyQuantity,
        SellQuantity    = p.DaySellQuantity,
        AveragePrice    = p.Quantity < 0
                            ? (p.SellPrice != 0 ? p.SellPrice : p.ClosePrice)
                            : (p.BuyPrice  != 0 ? p.BuyPrice  : p.ClosePrice),
        BuyPrice        = p.BuyPrice,
        SellPrice       = p.SellPrice,
        Ltp             = p.LastPrice,
        Pnl             = p.Pnl,
        Unrealised      = p.Unrealised,
        Realised        = p.Realised,
        BuyValue        = p.BuyValue,
        SellValue       = p.SellValue,
        Broker          = BrokerNames.Upstox,
    };
}
