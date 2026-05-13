using KAITerminal.RollingStraddle.Configuration;
using KAITerminal.RollingStraddle.Models;

namespace KAITerminal.RollingStraddle.Logic;

internal static class StrategyEngine
{
    /// <summary>
    /// Determines what action to take this tick.
    /// Pure: no I/O, no side effects — result depends only on the inputs.
    /// VIX validation is intentionally excluded; the orchestrator handles it before acting on Enter.
    /// </summary>
    internal static StrategyDecision Evaluate(
        StrategyState  state,
        MarketSnapshot snapshot,
        StrategyConfig config)
    {
        var entryTime = ParseTime(config.EntryTime);
        var exitTime  = ParseTime(config.ExitTime);

        return state.HasOpenLegs
            ? EvaluateActive(state, snapshot, config, exitTime)
            : EvaluateIdle(snapshot, entryTime, exitTime);
    }

    private static StrategyDecision EvaluateIdle(
        MarketSnapshot snapshot, TimeSpan entryTime, TimeSpan exitTime)
    {
        if (snapshot.TimeOfDay >= exitTime)
            return new StrategyDecision.Exit("past exit time with no entry");

        if (snapshot.TimeOfDay < entryTime)
            return new StrategyDecision.WaitForEntry(entryTime - snapshot.TimeOfDay);

        return new StrategyDecision.Enter();
    }

    private static StrategyDecision EvaluateActive(
        StrategyState  state,
        MarketSnapshot snapshot,
        StrategyConfig config,
        TimeSpan       exitTime)
    {
        if (snapshot.TimeOfDay >= exitTime)
            return new StrategyDecision.Exit("hard exit time");

        var effectiveTarget = config.DailyMtmTargetPerLot * config.Lots;
        var effectiveSl     = config.DailyMtmStopLossPerLot * config.Lots;

        if (snapshot.Pnl >= effectiveTarget)
            return new StrategyDecision.Exit("daily target hit");

        if (snapshot.Pnl <= -effectiveSl)
            return new StrategyDecision.Exit("MTM stop-loss");

        var movePct = MovePct(state.EntrySpot, snapshot.Spot);
        if (Math.Abs(movePct) >= config.RollThresholdPct)
        {
            return state.RollCount < config.MaxRolls
                ? new StrategyDecision.Roll(state.RollCount + 1, movePct)
                : new StrategyDecision.HoldMaxRolls(movePct);
        }

        return new StrategyDecision.Hold();
    }

    private static decimal MovePct(decimal entrySpot, decimal currentSpot) =>
        entrySpot > 0 ? (currentSpot - entrySpot) / entrySpot * 100m : 0m;

    private static TimeSpan ParseTime(string hhmm)
    {
        var parts = hhmm.Split(':');
        return new TimeSpan(int.Parse(parts[0]), int.Parse(parts[1]), 0);
    }
}
