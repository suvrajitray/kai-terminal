using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Services;

/// <summary>
/// Pure risk evaluation — no I/O, no side effects.
/// Call <see cref="Evaluate"/> to determine what action to take for a given MTM snapshot.
/// </summary>
public static class RiskDecisionCalculator
{
    /// <param name="mtm">Current portfolio MTM from the position cache.</param>
    /// <param name="config">User's risk configuration.</param>
    /// <param name="state">Current immutable risk-state snapshot.</param>
    /// <param name="nowIst">Current time-of-day in IST (trading timezone), used for auto square-off.</param>
    public static RiskDecision Evaluate(
        decimal mtm, UserConfig config, RiskStateSnapshot state, TimeSpan nowIst)
    {
        // 1. Hard stop loss
        if (mtm <= config.MtmSl)
            return new RiskDecision(RiskDecisionKind.ExitMtmSl);

        // 2. Profit target
        if (mtm >= config.MtmTarget)
            return new RiskDecision(RiskDecisionKind.ExitTarget);

        // 3. Auto square-off at configured time
        if (config.AutoSquareOffEnabled && nowIst >= config.AutoSquareOffTime)
            return new RiskDecision(RiskDecisionKind.ExitAutoSquareOff);

        // 4. Trailing stop loss
        if (!config.TrailingEnabled)
            return new RiskDecision(RiskDecisionKind.None);

        var trailingUpdate = TrailingStopCalculator.Evaluate(mtm, config, state);

        // Activation tick: lock the floor but do NOT exit on this tick
        // (matches original: activation and TSL-hit check are in separate branches)
        if (trailingUpdate?.IsActivation == true)
            return new RiskDecision(RiskDecisionKind.None, trailingUpdate);

        // Floor raise or no change: check whether TSL is now hit
        // Original mutates state.TrailingStop before checking, so the raised value is used.
        // trailingUpdate != null here means a floor raise occurred.
        bool tslHit;
        if (trailingUpdate is not null)
        {
            // Floor was just raised — check against the new (raised) floor
            tslHit = mtm <= trailingUpdate.NewStop;
        }
        else
        {
            // No raise — check against the existing floor (only if trailing is active)
            tslHit = state.TrailingActive && mtm <= state.TrailingStop;
        }

        if (tslHit)
            return new RiskDecision(RiskDecisionKind.ExitTrailingSl, trailingUpdate);

        return new RiskDecision(RiskDecisionKind.None, trailingUpdate);
    }
}
