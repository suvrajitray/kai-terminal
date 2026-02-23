using KAITerminal.RiskEngine.Infrastructure;
using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Risk;

public class StrikeMonitor
{
  private readonly IPositionProvider _positions;
  private readonly IOrderExecutor _orders;
  private readonly RiskConfig _config;
  private readonly PriceCache _priceCache;
  private readonly IRiskRepository _repo;

  public StrikeMonitor(
      IPositionProvider positions,
      IOrderExecutor orders,
      RiskConfig config,
      PriceCache priceCache,
      IRiskRepository repo)
  {
    _positions = positions;
    _orders = orders;
    _config = config;
    _priceCache = priceCache;
    _repo = repo;
  }

  public async Task EvaluateTickAsync(string strategyId)
  {
    var state = await _repo.GetStateAsync(strategyId);
    if (state.IsSquaredOff) return;

    var positions = await _positions.GetOpenPositionsAsync(strategyId);

    foreach (var pos in positions.Where(p => p.IsOpen))
    {
      var ltp = _priceCache.GetPrice(pos.Symbol);
      if (ltp <= 0) continue;

      decimal threshold = pos.OptionType == "CE"
          ? pos.AvgPrice * (1 + _config.StrikeSL.CePercent / 100)
          : pos.AvgPrice * (1 + _config.StrikeSL.PePercent / 100);

      if (ltp >= threshold)
      {
        await HandleStrikeAsync(strategyId, pos, state);
      }
    }
  }

  private async Task HandleStrikeAsync(
      string strategyId,
      Position pos,
      StrategyRiskState state)
  {
    state.ReEntries.TryGetValue(pos.Symbol, out var count);

    if (count >= _config.StrikeSL.MaxReEntry)
      return;

    await _orders.ExitPositionAsync(pos);

    count++;
    state.ReEntries[pos.Symbol] = count;
    state.UpdatedAt = DateTime.UtcNow;

    await _repo.SaveStateAsync(state);

    if (count < _config.StrikeSL.MaxReEntry)
    {
      await _orders.TakeNextOtmAsync(pos, _config.StrikeSL.StrikeGap);
    }
  }
}
