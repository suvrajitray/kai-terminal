using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Abstractions;

public interface IRiskRepository
{
    /// <summary>
    /// Computes a value from the state for <paramref name="stateKey"/> under the repository's
    /// synchronization strategy. Use this instead of reading the live mutable state directly.
    /// </summary>
    Task<T> ReadAsync<T>(string stateKey, Func<UserRiskState, T> read);

    /// <summary>
    /// Atomically applies <paramref name="mutate"/> to the state for <paramref name="stateKey"/>.
    /// Concurrent callers for the same key are serialised; different keys proceed in parallel.
    /// </summary>
    Task MutateAsync(string stateKey, Action<UserRiskState> mutate);

    Task ResetAsync(string stateKey);
}
