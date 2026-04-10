namespace KAITerminal.RiskEngine.Services;

public enum RiskDecisionKind
{
    None,
    ExitMtmSl,
    ExitTarget,
    ExitAutoSquareOff,
    ExitTrailingSl,
}

/// <summary>The outcome of a pure risk evaluation tick.</summary>
public sealed record RiskDecision(
    RiskDecisionKind Kind,
    /// <summary>
    /// State changes to apply to the trailing stop, regardless of whether Kind is an exit.
    /// Null when trailing is inactive or has no update this tick.
    /// </summary>
    TrailingStateUpdate? TrailingUpdate = null);

/// <summary>
/// New trailing stop floor values computed by <see cref="TrailingStopCalculator"/>.
/// </summary>
/// <param name="IsActivation">True on first activation; false on a floor raise.</param>
/// <param name="NewStop">The new trailing floor value.</param>
/// <param name="NewLastTrigger">The new last-trigger MTM value.</param>
public sealed record TrailingStateUpdate(
    bool IsActivation,
    decimal NewStop,
    decimal NewLastTrigger);
