namespace RiskEngine.Services;

using RiskEngine.Models;
class OrderExecutor : IOrderExecutor
{
  public Task CancelAllPendingAsync()
  {
    throw new NotImplementedException();
  }

  public Task ExitAllAsync()
  {
    throw new NotImplementedException();
  }

  public Task ExitPositionAsync(Position position)
  {
    throw new NotImplementedException();
  }

  public Task TakeNextOtmAsync(Position position, int strikeGap)
  {
    throw new NotImplementedException();
  }
}
