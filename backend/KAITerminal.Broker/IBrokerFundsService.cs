using KAITerminal.Contracts.Domain;

namespace KAITerminal.Broker;

/// <summary>Broker-agnostic interface for retrieving margin and funds information.</summary>
public interface IBrokerFundsService
{
    Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default);
}
