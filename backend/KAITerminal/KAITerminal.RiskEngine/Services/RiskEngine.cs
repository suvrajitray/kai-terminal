namespace RiskEngine.Services;

using RiskEngine.Models;
public class TerminalRiskEngine : IRiskEngine
{
  private readonly IPositionProvider _positionProvider;
  private readonly IOrderExecutor _orderExecutor;
  private readonly RiskConfig _config;
  private readonly RiskState _state;
  private readonly ILogger<TerminalRiskEngine> _logger;
  private readonly SemaphoreSlim _lock = new(1, 1);

  public TerminalRiskEngine(
      IPositionProvider positionProvider,
      IOrderExecutor orderExecutor,
      RiskConfig config,
      RiskState state,
      ILogger<TerminalRiskEngine> logger)
  {
    _positionProvider = positionProvider;
    _orderExecutor = orderExecutor;
    _config = config;
    _state = state;
    this._logger = logger;
  }

  public async Task EvaluateAsync(CancellationToken ct)
  {
    if (_state.IsSquaredOff) return;

    await _lock.WaitAsync(ct);
    try
    {
      var mtm = await _positionProvider.GetCurrentMtmAsync();
      var positions = await _positionProvider.GetOpenPositionsAsync();

      await CheckOverallRisk(mtm);
      await CheckTrailing(mtm);
      await CheckStrikeSl(positions);
    }
    finally
    {
      _lock.Release();
    }
  }

  // ================= OVERALL =================

  private async Task CheckOverallRisk(decimal mtm)
  {
    if (_state.IsSquaredOff) return;

    if (mtm <= _config.OverallStopLoss)
    {
      await SquareOff("OVERALL_SL");
      return;
    }

    if (mtm >= _config.OverallTarget)
    {
      await SquareOff("TARGET_HIT");
    }
  }

  private async Task SquareOff(string reason)
  {

    await _orderExecutor.CancelAllPendingAsync();
    await _orderExecutor.ExitAllAsync();
    _state.IsSquaredOff = true;
    _logger.LogInformation("[RISK] Square off triggered: {Reason}", reason);
  }

  // ================= TRAILING =================

  private async Task CheckTrailing(decimal mtm)
  {
    if (!_config.Trailing.Enabled || _state.IsSquaredOff)
      return;

    var t = _config.Trailing;

    if (!_state.TrailingActivated && mtm >= t.ActivateAt)
    {
      _state.TrailingActivated = true;
      _state.CurrentTrailingSl = t.LockProfitAt;
      _state.LastTrailTriggerMtm = mtm;

      _logger.LogInformation("[RISK] Trailing activated");
      return;
    }

    if (!_state.TrailingActivated) return;

    if (mtm - _state.LastTrailTriggerMtm >= t.ProfitStep)
    {
      _state.CurrentTrailingSl += t.TslIncrement;
      _state.LastTrailTriggerMtm = mtm;

      _logger.LogInformation("[RISK] Trailing moved to {_CurrentTrailingSl}", _state.CurrentTrailingSl);
    }

    if (mtm <= _state.CurrentTrailingSl)
    {
      await SquareOff("TRAILING_SL_HIT");
    }
  }

  // ================= STRIKE SL =================

  private async Task CheckStrikeSl(List<Position> positions)
  {
    foreach (var pos in positions.Where(p => p.IsOpen))
    {
      decimal threshold = pos.OptionType == "CE"
          ? pos.AvgPrice * (1 + _config.StrikeSL.CePercent / 100)
          : pos.AvgPrice * (1 + _config.StrikeSL.PePercent / 100);

      if (pos.Ltp >= threshold)
      {
        await HandleStrikeSl(pos);
      }
    }
  }

  private async Task HandleStrikeSl(Position pos)
  {
    await _orderExecutor.ExitPositionAsync(pos);

    pos.ReEntryCount++;

    _logger.LogInformation("[RISK] Strike SL hit for {Symbol}", pos.Symbol);

    if (pos.ReEntryCount >= _config.StrikeSL.MaxReEntry)
    {
      _logger.LogInformation("[RISK] Max re-entry reached");
      return;
    }

    await _orderExecutor.TakeNextOtmAsync(pos, _config.StrikeSL.StrikeGap);
  }
}
