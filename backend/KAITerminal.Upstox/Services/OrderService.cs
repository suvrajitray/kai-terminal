using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

internal sealed class OrderService : IOrderService
{
    private readonly UpstoxHttpClient _http;

    public OrderService(UpstoxHttpClient http)
    {
        _http = http;
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<Order>> GetAllOrdersAsync(CancellationToken cancellationToken = default)
        => _http.GetAllOrdersAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(
        CancellationToken cancellationToken = default)
    {
        var orders = await GetAllOrdersAsync(cancellationToken);
        var cancellable = orders.Where(o => o.IsCancellable).ToList();

        if (cancellable.Count == 0)
            return [];

        // Cancel concurrently using v2 endpoint.
        var tasks = cancellable.Select(o => _http.CancelOrderV2Async(o.OrderId, cancellationToken));
        var results = await Task.WhenAll(tasks);
        return results.AsReadOnly();
    }

    /// <inheritdoc />
    public Task<string> CancelOrderAsync(string orderId, CancellationToken cancellationToken = default)
        => _http.CancelOrderV2Async(orderId, cancellationToken);

    /// <inheritdoc />
    public Task<(string OrderId, int Latency)> CancelOrderV3Async(
        string orderId, CancellationToken cancellationToken = default)
        => _http.CancelOrderV3Async(orderId, cancellationToken);

    /// <inheritdoc />
    public Task<PlaceOrderResult> PlaceOrderAsync(
        PlaceOrderRequest request, CancellationToken cancellationToken = default)
        => _http.PlaceOrderV2Async(request, cancellationToken);

    /// <inheritdoc />
    public Task<PlaceOrderV3Result> PlaceOrderV3Async(
        PlaceOrderRequest request, CancellationToken cancellationToken = default)
        => _http.PlaceOrderV3Async(request, cancellationToken);
}
