using KAITerminal.Broker.Models;
using KAITerminal.Types;

namespace KAITerminal.Broker.Interfaces;

public interface IPositionProvider
{
  Task<List<Position>> GetOpenPositionsAsync(AccessToken accessToken, string strategyId = "");
  Task<decimal> GetCurrentMtmAsync(AccessToken accessToken, string strategyId = "");
}
