using System.Collections.Concurrent;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.State;

/// <summary>Thread-safe in-memory store for per-user risk state.</summary>
public sealed class InMemoryRiskRepository : IRiskRepository
{
    private readonly ConcurrentDictionary<string, UserRiskState> _states = new(StringComparer.Ordinal);

    public UserRiskState GetOrCreate(string userId)
        => _states.GetOrAdd(userId, _ => new UserRiskState());

    public void Update(string userId, UserRiskState state)
        => _states[userId] = state;

    public void Reset(string userId)
        => _states[userId] = new UserRiskState();
}
