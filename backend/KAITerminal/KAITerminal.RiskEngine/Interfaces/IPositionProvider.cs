using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Interfaces;

public interface IPositionProvider
{
  Task<List<Position>> GetOpenPositionsAsync(string strategyId);
  Task<decimal> GetCurrentMtmAsync(string strategyId);
}
