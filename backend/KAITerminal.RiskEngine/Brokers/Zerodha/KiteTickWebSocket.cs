using KAITerminal.RiskEngine.Infrastructure;
using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Workers;

namespace KAITerminal.RiskEngine.Brokers.Zerodha;

public class KiteTickWebSocket
{
  private readonly PriceCache _cache;
  private readonly TickRiskWorker _worker;
  private readonly IStrategyProvider _strategies;

  public KiteTickWebSocket(
      PriceCache cache,
      TickRiskWorker worker,
      IStrategyProvider strategies)
  {
    _cache = cache;
    _worker = worker;
    _strategies = strategies;
  }

  public async Task OnTickAsync(string symbol, decimal ltp)
  {
    _cache.UpdatePrice(symbol, ltp);

    var ids = await _strategies.GetActiveStrategiesAsync();

    foreach (var id in ids)
    {
      _worker.Enqueue(id);
    }
  }
}
