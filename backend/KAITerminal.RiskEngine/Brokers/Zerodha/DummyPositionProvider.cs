using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Models;
using KAITerminal.Types;

namespace KAITerminal.RiskEngine.Brokers.Zerodha;

public class DummyPositionProvider : IPositionProvider
{
  // 🔥 simple in-memory test state
  private decimal _mtm = 0;
  public Task<List<Position>> GetOpenPositionsAsync(AccessToken accessToken, string strategyId)
  {
    // TODO: replace with real Zerodha positions
    var positions = new List<Position>
        {
            new Position
            {
                Symbol = "NIFTY24FEB22000CE",
                OptionType = "CE",
                AveragePrice = 100,
                Quantity = -50,
                IsOpen = true
            }
        };

    return Task.FromResult(positions);
  }

  public Task<decimal> GetCurrentMtmAsync(AccessToken accessToken, string strategyId)
  {
    // TODO: replace with real MTM
    // simulate MTM movement
    _mtm += Random.Shared.Next(-500, 500);
    return Task.FromResult(_mtm);
  }
}
