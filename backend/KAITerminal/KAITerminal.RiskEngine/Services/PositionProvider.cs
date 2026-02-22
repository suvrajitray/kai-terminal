namespace RiskEngine.Services;

using RiskEngine.Models;
public class PositionProvider : IPositionProvider
{
  public Task<decimal> GetCurrentMtmAsync()
  {
    throw new NotImplementedException();
  }

  public Task<List<Position>> GetOpenPositionsAsync()
  {
    throw new NotImplementedException();
  }
}
