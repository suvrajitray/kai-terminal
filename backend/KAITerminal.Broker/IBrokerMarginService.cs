using KAITerminal.Contracts.Domain;

namespace KAITerminal.Broker;

/// <summary>Broker-agnostic interface for calculating required margin on hypothetical orders.</summary>
public interface IBrokerMarginService
{
    Task<BrokerMarginResult> GetRequiredMarginAsync(
        IEnumerable<BrokerMarginOrderItem> items, CancellationToken ct = default);
}
