using KAITerminal.Contracts.Domain;

namespace KAITerminal.Broker;

/// <summary>Broker-agnostic interface for position management and MTM operations.</summary>
public interface IBrokerPositionService
{
    Task<IReadOnlyList<BrokerPosition>> GetAllPositionsAsync(CancellationToken ct = default);
    Task<decimal> GetTotalMtmAsync(CancellationToken ct = default);

    /// <returns>Order IDs created for the exits. Empty when the broker does not surface order IDs.</returns>
    Task<IReadOnlyList<string>> ExitAllPositionsAsync(
        IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default);

    /// <returns>Order ID created for the exit. Empty string when the broker does not surface order IDs.</returns>
    Task<string> ExitPositionAsync(string instrumentToken, string product, CancellationToken ct = default);

    Task ConvertPositionAsync(string instrumentToken, string oldProduct, int quantity, CancellationToken ct = default);
}
