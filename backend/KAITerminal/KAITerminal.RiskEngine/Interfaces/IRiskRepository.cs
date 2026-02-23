using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Interfaces;

public interface IRiskRepository
{
  Task<StrategyRiskState> GetStateAsync(string strategyId);
  Task SaveStateAsync(StrategyRiskState state);
  Task<bool> TryMarkSquaredOffAsync(string strategyId);
  Task ResetAsync(string strategyId);
}
