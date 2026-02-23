using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Interfaces;

public interface IOrderExecutor
{
  Task ExitAllAsync(string strategyId);
  Task ExitPositionAsync(Position position);
  Task TakeNextOtmAsync(Position position, int strikeGap);
  Task CancelAllPendingAsync(string strategyId);
}
