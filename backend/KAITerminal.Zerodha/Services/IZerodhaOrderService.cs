using KAITerminal.Contracts.Domain;

namespace KAITerminal.Zerodha.Services;

public interface IZerodhaOrderService
{
    Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default);
}
