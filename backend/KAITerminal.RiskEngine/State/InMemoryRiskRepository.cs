using System.Collections.Concurrent;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.State;

/// <summary>
/// In-memory risk state store. State is scoped to the current process — a Worker restart
/// always starts clean. A date check in <see cref="Workers.StreamingRiskWorker"/> resets
/// any stale state left behind by a forgotten daily restart.
/// Key pattern: <c>{userId}::{broker}</c>
/// </summary>
internal sealed class InMemoryRiskRepository : IRiskRepository
{
    private readonly ConcurrentDictionary<string, UserRiskState> _states = new(StringComparer.Ordinal);

    public Task<T> ReadAsync<T>(string stateKey, Func<UserRiskState, T> read)
    {
        var state = _states.GetOrAdd(stateKey, _ => new UserRiskState());
        lock (state) { return Task.FromResult(read(state)); }
    }

    public Task MutateAsync(string stateKey, Action<UserRiskState> mutate)
    {
        var state = _states.GetOrAdd(stateKey, _ => new UserRiskState());
        lock (state) { mutate(state); }
        return Task.CompletedTask;
    }

    public Task ResetAsync(string stateKey)
    {
        _states.TryRemove(stateKey, out _);
        return Task.CompletedTask;
    }
}
