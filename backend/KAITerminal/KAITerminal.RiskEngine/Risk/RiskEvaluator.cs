using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Zerodha;
using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Models;
using KAITerminal.Types;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Risk;

public class RiskEvaluator(
    IPositionProvider positions,
    IOrderExecutor orders,
    RiskConfig config,
    IRiskRepository repo,
    IOptions<ZerodhaSettings> zerodhaSettings,
    ILogger<RiskEvaluator> logger)
{
  public async Task EvaluateAsync(string strategyId)
  {
    var state = await repo.GetStateAsync(strategyId);
    if (state.IsSquaredOff) return;

    var mtm = await positions.GetCurrentMtmAsync(
      new AccessToken(zerodhaSettings.Value.AccessToken),
      strategyId);

    if (state.TrailingActivated)
    {
      logger.LogInformation("Strategy {id} MTM: {mtm}, TSL: {tsl}, Target: {target}",
        strategyId, mtm, state.CurrentTrailingSl, config.OverallTarget);
    }
    else
    {
      logger.LogInformation("Strategy {id} MTM: {mtm}, SL: {sl}, Target: {target}",
        strategyId, mtm, config.OverallStopLoss, config.OverallTarget);
    }

    if (mtm <= config.OverallStopLoss)
    {
      logger.LogInformation("Overall SL hit! MTM: {mtm}, SL: {sl}", mtm, config.OverallStopLoss);
      await SquareOff(new AccessToken(zerodhaSettings.Value.AccessToken), strategyId, "OVERALL_SL");
      return;
    }

    if (mtm >= config.OverallTarget)
    {
      logger.LogInformation("Overall Target hit! MTM: {mtm}, Target: {target}", mtm, config.OverallTarget);
      await SquareOff(new AccessToken(zerodhaSettings.Value.AccessToken), strategyId, "TARGET_HIT");
      return;
    }

    await HandleTrailing(strategyId, state, mtm);
  }

  private async Task SquareOff(AccessToken accessToken, string strategyId, string reason)
  {
    var marked = await repo.TryMarkSquaredOffAsync(strategyId);
    if (!marked) return;

    await orders.CancelAllPendingAsync(accessToken, strategyId);
    await orders.ExitAllAsync(accessToken, strategyId);

    logger.LogInformation("[RISK] Square off: {reason}\n\n", reason);
  }

  private async Task HandleTrailing(
      string strategyId,
      StrategyRiskState state,
      decimal mtm)
  {
    var t = config.Trailing;
    if (!t.Enabled) return;
    if (!state.TrailingActivated && mtm >= t.ActivateAt)
    {
      state.TrailingActivated = true;
      state.CurrentTrailingSl = t.LockProfitAt;
      state.LastTrailTriggerMtm = mtm;
      await repo.SaveStateAsync(state);
      logger.LogInformation(
        "Trailing SL activated at MTM: {mtm}, Initial TSL set to: {tsl}",
        mtm, state.CurrentTrailingSl);
      return;
    }

    if (!state.TrailingActivated) return;

    if (mtm - state.LastTrailTriggerMtm >= t.ProfitStep)
    {
      state.CurrentTrailingSl += t.TslIncrement;
      state.LastTrailTriggerMtm = mtm;
      await repo.SaveStateAsync(state);
      logger.LogInformation(
        "Trailing SL moved up! MTM: {mtm}, Current TSL: {tsl}",
        mtm, state.CurrentTrailingSl);
    }

    if (mtm <= state.CurrentTrailingSl)
    {
      logger.LogInformation(
        "Trailing SL hit! MTM: {mtm}, Current TSL: {tsl}",
        mtm, state.CurrentTrailingSl);
      await SquareOff(new AccessToken(zerodhaSettings.Value.AccessToken), strategyId, "TRAILING_SL");
    }
  }
}
