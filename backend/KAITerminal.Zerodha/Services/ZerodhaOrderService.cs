using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaOrderService : IBrokerOrderService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaOrderService(ZerodhaHttpClient http) => _http = http;

    public async Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
    {
        var orders = await _http.GetOrdersAsync(ct);
        return orders.Select(o => new BrokerOrder
        {
            OrderId         = o.OrderId         ?? "",
            ExchangeOrderId = o.ExchangeOrderId ?? "",
            Exchange        = o.Exchange         ?? "",
            TradingSymbol   = o.TradingSymbol    ?? "",
            Product         = o.Product          ?? "",
            OrderType       = o.OrderType        ?? "",
            TransactionType = o.TransactionType  ?? "",
            Validity        = o.Validity         ?? "",
            Status          = o.Status           ?? "",
            StatusMessage   = o.StatusMessage    ?? "",
            Price           = o.Price,
            AveragePrice    = o.AveragePrice,
            Quantity        = o.Quantity,
            FilledQuantity  = o.FilledQuantity,
            PendingQuantity = o.PendingQuantity,
            Tag             = o.Tag,
            OrderTimestamp  = o.OrderTimestamp,
        }).ToList();
    }

    public Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        var parts    = request.InstrumentToken.Split('|', 2);
        var exchange = parts.Length == 2 ? parts[0] : "NFO";
        var symbol   = parts.Length == 2 ? parts[1] : request.InstrumentToken;
        var kiteProduct = ZerodhaProductMap.ToKite(request.Product, exchange);

        return _http.PlaceOrderAsync(
            symbol, exchange,
            request.TransactionType.ToUpperInvariant(),
            kiteProduct,
            request.OrderType.ToUpperInvariant(),
            request.Quantity,
            request.Price,
            ct);
    }

    public Task<string> CancelOrderAsync(string orderId, CancellationToken ct = default)
        => _http.CancelOrderAsync(orderId, ct);

    public Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<string>>([]);
}
