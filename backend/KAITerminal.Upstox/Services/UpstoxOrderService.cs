using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

internal sealed class UpstoxOrderService : IBrokerOrderService, IUpstoxHftService
{
    private readonly UpstoxHttpClient _http;

    public UpstoxOrderService(UpstoxHttpClient http) => _http = http;

    // ── IBrokerOrderService ───────────────────────────────────────────────────

    async Task<IReadOnlyList<BrokerOrder>> IBrokerOrderService.GetAllOrdersAsync(CancellationToken ct)
    {
        var orders = await _http.GetAllOrdersAsync(ct);
        return orders.Select(o => new BrokerOrder
        {
            OrderId       = o.OrderId,
            TradingSymbol = o.TradingSymbol,
            Status        = o.Status,
            StatusMessage = o.StatusMessage,
        }).ToList().AsReadOnly();
    }

    public async Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        var txType = request.TransactionType.Equals("BUY", StringComparison.OrdinalIgnoreCase)
            ? TransactionType.Buy : TransactionType.Sell;

        var orderType = request.OrderType.Equals("LIMIT", StringComparison.OrdinalIgnoreCase)
            ? OrderType.Limit : OrderType.Market;

        var product = request.Product.ToUpperInvariant() switch
        {
            "D" or "CNC" or "DELIVERY" => Product.Delivery,
            "MTF"                       => Product.MTF,
            "CO"                        => Product.CoverOrder,
            _                           => Product.Intraday,
        };

        var result = await _http.PlaceOrderV3Async(new PlaceOrderRequest
        {
            InstrumentToken = request.InstrumentToken,
            Quantity        = request.Quantity,
            TransactionType = txType,
            OrderType       = orderType,
            Product         = product,
            Price           = request.Price ?? 0,
            Slice           = true,
        }, ct);

        return string.Join(",", result.OrderIds);
    }

    public async Task<string> CancelOrderAsync(string orderId, CancellationToken ct = default)
    {
        var (id, _) = await _http.CancelOrderV3Async(orderId, ct);
        return id;
    }

    public async Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken ct = default)
    {
        var orders = await _http.GetAllOrdersAsync(ct);
        var cancellable = orders.Where(o => o.IsCancellable).ToList();

        if (cancellable.Count == 0)
            return [];

        var tasks = cancellable.Select(o =>
            _http.CancelOrderV3Async(o.OrderId, ct).ContinueWith(t => t.Result.OrderId));
        var results = await Task.WhenAll(tasks);
        return results.AsReadOnly();
    }

    // ── IUpstoxHftService ─────────────────────────────────────────────────────

    Task<IReadOnlyList<Order>> IUpstoxHftService.GetAllOrdersAsync(CancellationToken ct)
        => _http.GetAllOrdersAsync(ct);

    Task<PlaceOrderV3Result> IUpstoxHftService.PlaceOrderV3Async(PlaceOrderRequest request, CancellationToken ct)
        => _http.PlaceOrderV3Async(request, ct);

    Task<(string OrderId, int Latency)> IUpstoxHftService.CancelOrderV3Async(string orderId, CancellationToken ct)
        => _http.CancelOrderV3Async(orderId, ct);
}
