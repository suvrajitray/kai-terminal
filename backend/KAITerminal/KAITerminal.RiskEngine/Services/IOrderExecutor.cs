using RiskEngine.Models;

public interface IOrderExecutor
{
  Task ExitAllAsync();
  Task ExitPositionAsync(Position position);
  Task TakeNextOtmAsync(Position position, int strikeGap);
  Task CancelAllPendingAsync();
}
