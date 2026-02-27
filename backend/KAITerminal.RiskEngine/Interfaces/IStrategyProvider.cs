namespace KAITerminal.RiskEngine.Interfaces;

public interface IStrategyProvider
{
  Task<IReadOnlyList<string>> GetActiveStrategiesAsync();
  Task ActivateAsync(string strategyId);
  Task DeactivateAsync(string strategyId);
  Task<bool> IsActiveAsync(string strategyId);
}
