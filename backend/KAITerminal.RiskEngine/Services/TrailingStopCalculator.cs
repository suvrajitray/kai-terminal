using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Services;

/// <summary>
/// Pure trailing stop floor calculations — no I/O, no state mutation.
/// </summary>
public static class TrailingStopCalculator
{
    /// <summary>
    /// Returns a <see cref="TrailingStateUpdate"/> if the trailing stop should be activated
    /// or its floor raised, or null if no change is needed.
    /// </summary>
    public static TrailingStateUpdate? Evaluate(
        decimal mtm, UserConfig config, RiskStateSnapshot state)
    {
        if (!config.TrailingEnabled) return null;

        if (!state.TrailingActive)
        {
            if (mtm >= config.TrailingActivateAt)
                return new TrailingStateUpdate(
                    IsActivation: true,
                    NewStop: config.LockProfitAt,
                    NewLastTrigger: config.TrailingActivateAt);
            return null;
        }

        // Trailing is already active — check if floor should be raised
        var gain = mtm - state.TrailingLastTrigger;
        if (gain < config.WhenProfitIncreasesBy) return null;

        var steps = (long)(gain / config.WhenProfitIncreasesBy);
        return new TrailingStateUpdate(
            IsActivation: false,
            NewStop: state.TrailingStop + steps * config.IncreaseTrailingBy,
            NewLastTrigger: state.TrailingLastTrigger + steps * config.WhenProfitIncreasesBy);
    }
}
