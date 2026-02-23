using System.Collections.Concurrent;
using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Infrastructure;

public class InMemoryRiskRepository : IRiskRepository
{
  private readonly ConcurrentDictionary<string, StrategyRiskState> _store = new();
  private readonly SemaphoreSlim _lock = new(1, 1);

  public Task<StrategyRiskState> GetStateAsync(string strategyId)
  {
    var state = _store.GetOrAdd(strategyId, id => new StrategyRiskState
    {
      StrategyId = id,
      UpdatedAt = DateTime.UtcNow
    });

    return Task.FromResult(state);
  }

  public async Task SaveStateAsync(StrategyRiskState state)
  {
    await _lock.WaitAsync();
    try
    {
      state.UpdatedAt = DateTime.UtcNow;
      _store[state.StrategyId] = state;
    }
    finally { _lock.Release(); }
  }

  public async Task<bool> TryMarkSquaredOffAsync(string strategyId)
  {
    await _lock.WaitAsync();
    try
    {
      var state = await GetStateAsync(strategyId);
      if (state.IsSquaredOff) return false;

      state.IsSquaredOff = true;
      _store[strategyId] = state;
      return true;
    }
    finally { _lock.Release(); }
  }

  public Task ResetAsync(string strategyId)
  {
    _store.TryRemove(strategyId, out _);
    return Task.CompletedTask;
  }
}
