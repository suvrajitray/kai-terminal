using KAITerminal.Broker.Models;
using KAITerminal.Types;

namespace KAITerminal.Broker.Interfaces;

public interface IOrderExecutor
{
  Task ExitAllAsync(AccessToken accessToken, string strategyId);
  Task ExitPositionAsync(AccessToken accessToken, Position position);
  Task TakeNextOtmAsync(AccessToken accessToken, Position position, int strikeGap);
  Task CancelAllPendingAsync(AccessToken accessToken, string strategyId);
}
