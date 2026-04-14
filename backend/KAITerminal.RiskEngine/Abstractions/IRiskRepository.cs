using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Abstractions;

public interface IRiskRepository
{
    Task<UserRiskState> GetOrCreateAsync(string stateKey);

    /// <summary>
    /// Atomically applies <paramref name="mutate"/> to the state for <paramref name="stateKey"/>.
    /// Concurrent callers for the same key are serialised; different keys proceed in parallel.
    /// </summary>
    Task MutateAsync(string stateKey, Action<UserRiskState> mutate);

    Task ResetAsync(string stateKey);
}
