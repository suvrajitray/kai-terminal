namespace KAITerminal.RollingStraddle.Models;

internal abstract record StrategyDecision
{
    internal sealed record WaitForEntry(TimeSpan Remaining)        : StrategyDecision;
    internal sealed record Enter                                   : StrategyDecision;
    internal sealed record Hold                                    : StrategyDecision;
    internal sealed record Roll(int RollNumber, decimal MovePct)   : StrategyDecision;
    internal sealed record HoldMaxRolls(decimal MovePct)           : StrategyDecision;
    internal sealed record Exit(string Reason)                     : StrategyDecision;
}
