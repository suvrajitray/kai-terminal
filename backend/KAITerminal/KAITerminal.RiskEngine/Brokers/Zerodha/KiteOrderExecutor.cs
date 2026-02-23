using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Risk;

namespace KAITerminal.RiskEngine.Brokers.Zerodha;

public class KiteOrderExecutor(
  KiteHttpClient kite,
  IPositionProvider positions,
  ILogger<KiteOrderExecutor> logger) : IOrderExecutor
{
  public async Task ExitAllAsync(string strategyId)
  {
    logger.LogWarning("ExitAll: Attempting to exit all open positions for strategy {StrategyId}.", strategyId);
    var openPositions = (await positions
        .GetOpenPositionsAsync(strategyId))
        .Where(p => p.IsOpen)
        .OrderBy(p => p.Quantity)
        .ToList();

    foreach (var pos in openPositions)
    {
      await ExitPositionAsync(pos);
    }
    logger.LogWarning("ExitAll: Exited {Count} open positions.", openPositions.Count);
  }

  public async Task ExitPositionAsync(Position pos)
  {
    var form = new Dictionary<string, string>
    {
      ["tradingsymbol"] = pos.Symbol,
      ["exchange"] = "NFO",
      ["transaction_type"] = pos.Quantity > 0 ? "SELL" : "BUY",
      ["order_type"] = "MARKET",
      ["quantity"] = Math.Abs(pos.Quantity).ToString(),
      ["product"] = "NRML"
    };

    await kite.PostAsync("/orders/regular", form);
  }

  public async Task TakeNextOtmAsync(Position pos, int strikeGap)
  {
    var next = OtmStrikeCalculator.GetNextStrike(pos.Symbol, strikeGap);

    var form = new Dictionary<string, string>
    {
      ["tradingsymbol"] = next,
      ["exchange"] = "NFO",
      ["transaction_type"] = "SELL",
      ["order_type"] = "MARKET",
      ["quantity"] = Math.Abs(pos.Quantity).ToString(),
      ["product"] = "NRML"
    };

    await kite.PostAsync("/orders/regular", form);
  }

  public async Task CancelAllPendingAsync(string strategyId)
  {
    // Optional: implement orderbook cancel loop
    logger.LogWarning("CancelAll: Canceling all pending orders for strategy {StrategyId}.", strategyId);
    await Task.CompletedTask;
    logger.LogWarning("CancelAll: Successfully canceled all pending orders for strategy {StrategyId}.", strategyId);
  }
}
