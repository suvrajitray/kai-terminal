using System.Collections.Concurrent;

namespace KAITerminal.RiskEngine.Infrastructure;

public class PriceCache
{
  private readonly ConcurrentDictionary<string, decimal> _prices = new();

  public void UpdatePrice(string symbol, decimal ltp)
      => _prices[symbol] = ltp;

  public decimal GetPrice(string symbol)
      => _prices.TryGetValue(symbol, out var p) ? p : 0;
}
