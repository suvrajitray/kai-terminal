using KAITerminal.Contracts.Domain;

namespace KAITerminal.Broker;

/// <summary>Broker-agnostic interface for order management.</summary>
public interface IBrokerOrderService
{
    Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default);
    Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default);
    Task<string> CancelOrderAsync(string orderId, CancellationToken ct = default);
    Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken ct = default);
}
