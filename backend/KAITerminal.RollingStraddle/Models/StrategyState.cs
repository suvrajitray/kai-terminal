using System.Collections.Immutable;

namespace KAITerminal.RollingStraddle.Models;

internal sealed record StrategyState(
    Leg?                     CeLeg,
    Leg?                     PeLeg,
    decimal                  EntrySpot,
    int                      RollCount,
    ImmutableHashSet<string> TradedTokens)
{
    public static readonly StrategyState Empty =
        new(null, null, 0m, 0, ImmutableHashSet.Create<string>(StringComparer.OrdinalIgnoreCase));

    public bool HasOpenLegs => CeLeg is not null && PeLeg is not null;

    public DateTimeOffset? ReEntryAfter { get; init; }
}
