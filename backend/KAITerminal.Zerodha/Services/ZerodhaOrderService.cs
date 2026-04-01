using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaOrderService : IBrokerOrderService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaOrderService(ZerodhaHttpClient http) => _http = http;

    // Zerodha order history endpoint not yet implemented — returns empty list.
    public Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<BrokerOrder>>([]);

    public Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        // Parse "EXCHANGE|SYMBOL" token format into components
        var parts   = request.InstrumentToken.Split('|', 2);
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

    // Zerodha order history not yet implemented, so cancellable orders cannot be determined.
    public Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<string>>([]);
}
