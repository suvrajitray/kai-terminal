using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

/// <summary>Upstox-specific order operations using v3 HFT endpoints and raw order types.</summary>
public interface IUpstoxHftService
{
    /// <summary>Retrieve all orders for the current day with full Upstox order detail.</summary>
    Task<IReadOnlyList<Order>> GetAllOrdersAsync(CancellationToken ct = default);

    /// <summary>Place an order via the v3 HFT endpoint. Supports auto-slicing.</summary>
    Task<PlaceOrderV3Result> PlaceOrderV3Async(PlaceOrderRequest request, CancellationToken ct = default);

    /// <summary>Cancel a single order via the v3 HFT endpoint. Returns order ID and latency in ms.</summary>
    Task<(string OrderId, int Latency)> CancelOrderV3Async(string orderId, CancellationToken ct = default);
}
