using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

/// <summary>
/// Provides order management operations (Features 5–6).
/// </summary>
public interface IOrderService
{
    /// <summary>Retrieve all orders placed during the current trading day.</summary>
    Task<IReadOnlyList<Order>> GetAllOrdersAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 5 — Cancel every open / pending order in the order book.
    /// </summary>
    /// <returns>List of order IDs that were cancelled.</returns>
    Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken cancellationToken = default);

    /// <summary>Cancel a single order by ID (v2 endpoint).</summary>
    Task<string> CancelOrderAsync(string orderId, CancellationToken cancellationToken = default);

    /// <summary>Cancel a single order by ID (v3 HFT endpoint). Returns order ID and API latency in ms.</summary>
    Task<(string OrderId, int Latency)> CancelOrderV3Async(string orderId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 6 — Place a standard order (v2 endpoint).
    /// </summary>
    Task<PlaceOrderResult> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 6 — Place a standard order (v3 HFT endpoint).
    /// Supports auto-slicing via <see cref="PlaceOrderRequest.Slice"/>.
    /// </summary>
    Task<PlaceOrderV3Result> PlaceOrderV3Async(PlaceOrderRequest request, CancellationToken cancellationToken = default);
}
