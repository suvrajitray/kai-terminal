using KAITerminal.Contracts.Domain;

namespace KAITerminal.Zerodha.Services;

public interface IZerodhaOrderService
{
    Task<IReadOnlyList<KAITerminal.Contracts.Domain.BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default);
    Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default);
}
