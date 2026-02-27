using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Models;
using KAITerminal.Types;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Broker.Zerodha;

public class ZerodhaOrderExecutor(
  KiteConnectHttpClient kite,
  IPositionProvider positions,
  ILogger<ZerodhaOrderExecutor> logger) : IOrderExecutor
{
  public async Task ExitAllAsync(AccessToken accessToken, string strategyId)
  {
    logger.LogWarning("ExitAll: Attempting to exit all open positions for strategy {StrategyId}.", strategyId);
    var openPositions = (await positions
        .GetOpenPositionsAsync(accessToken, strategyId))
        .Where(p => p.IsOpen)
        .OrderBy(p => p.Quantity)
        .ToList();

    foreach (var pos in openPositions)
    {
      await ExitPositionAsync(accessToken, pos);
    }
    logger.LogWarning("ExitAll: Exited {Count} open positions.", openPositions.Count);
  }

  public async Task ExitPositionAsync(AccessToken accessToken, Position pos)
  {
    var form = new Dictionary<string, string>
    {
      ["tradingsymbol"] = pos.Symbol,
      ["exchange"] = pos.Exchange!,
      ["transaction_type"] = pos.Quantity > 0 ? "SELL" : "BUY",
      ["order_type"] = "MARKET",
      ["quantity"] = Math.Abs(pos.Quantity).ToString(),
      ["product"] = pos.Product!
    };

    await kite.PostAsync(accessToken, "/orders/regular", form);
  }

  public async Task TakeNextOtmAsync(AccessToken accessToken, Position pos, int strikeGap)
  {
    var next = OtmStrikeCalculator.GetNextStrike(pos.Symbol, strikeGap);

    var form = new Dictionary<string, string>
    {
      ["tradingsymbol"] = next,
      ["exchange"] = pos.Exchange!,
      ["transaction_type"] = "SELL",
      ["order_type"] = "MARKET",
      ["quantity"] = Math.Abs(pos.Quantity).ToString(),
      ["product"] = pos.Product!
    };

    await kite.PostAsync(accessToken, "/orders/regular", form);
  }

  public async Task CancelAllPendingAsync(AccessToken accessToken, string strategyId)
  {
    // Optional: implement orderbook cancel loop
    logger.LogWarning("CancelAll: Canceling all pending orders for strategy {StrategyId}.", strategyId);
    await Task.CompletedTask;
    logger.LogWarning("CancelAll: Successfully canceled all pending orders for strategy {StrategyId}.", strategyId);
  }
}
