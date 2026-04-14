using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Abstractions;

public interface IRiskRepository
{
    Task<UserRiskState> GetOrCreateAsync(string userId);
    Task UpdateAsync(string userId, UserRiskState state);
    Task ResetAsync(string userId);

    /// <summary>
    /// Atomically reads the state for <paramref name="stateKey"/>, applies
    /// <paramref name="mutate"/>, then writes it back. Concurrent callers for
    /// the same key are serialised; different keys proceed in parallel.
    /// </summary>
    Task MutateAsync(string stateKey, Action<UserRiskState> mutate);
}
