namespace KAITerminal.RiskEngine.Models;

/// <summary>
/// Immutable snapshot of per-user risk state for pure decision logic.
/// This is the safe read model exposed outside the repository boundary.
/// </summary>
public sealed record RiskStateSnapshot(
    DateOnly LastResetDate,
    bool IsSquaredOff,
    bool TrailingActive,
    decimal TrailingStop,
    decimal TrailingLastTrigger,
    IReadOnlyDictionary<string, int> ReentryCounts,
    IReadOnlyDictionary<string, int> AutoShiftCounts,
    IReadOnlyDictionary<string, string> ShiftOriginMap,
    IReadOnlySet<string> ExitedChainKeys)
{
    public static RiskStateSnapshot From(UserRiskState state) => new(
        state.LastResetDate,
        state.IsSquaredOff,
        state.TrailingActive,
        state.TrailingStop,
        state.TrailingLastTrigger,
        new Dictionary<string, int>(state.ReentryCounts, StringComparer.Ordinal),
        new Dictionary<string, int>(state.AutoShiftCounts, StringComparer.Ordinal),
        new Dictionary<string, string>(state.ShiftOriginMap, StringComparer.Ordinal),
        new HashSet<string>(state.ExitedChainKeys, StringComparer.Ordinal));
}
