using RiskEngine.Models;

public interface IPositionProvider
{
  Task<List<Position>> GetOpenPositionsAsync();
  Task<decimal> GetCurrentMtmAsync();
}
