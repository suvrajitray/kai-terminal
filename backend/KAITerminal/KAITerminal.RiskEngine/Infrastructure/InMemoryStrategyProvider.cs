using System.Collections.Concurrent;
using KAITerminal.RiskEngine.Interfaces;

namespace KAITerminal.RiskEngine.Infrastructure;

public class InMemoryStrategyProvider : IStrategyProvider
{
  private readonly ConcurrentDictionary<string, byte> _active = new();

  public Task<IReadOnlyList<string>> GetActiveStrategiesAsync()
      => Task.FromResult((IReadOnlyList<string>)_active.Keys.ToList());

  public Task ActivateAsync(string strategyId)
  {
    _active[strategyId] = 1;
    return Task.CompletedTask;
  }

  public Task DeactivateAsync(string strategyId)
  {
    _active.TryRemove(strategyId, out _);
    return Task.CompletedTask;
  }

  public Task<bool> IsActiveAsync(string strategyId)
      => Task.FromResult(_active.ContainsKey(strategyId));
}
