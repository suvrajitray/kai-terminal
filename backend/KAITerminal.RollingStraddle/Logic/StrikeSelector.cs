using KAITerminal.Contracts.Options;

namespace KAITerminal.RollingStraddle.Logic;

internal static class StrikeSelector
{
    /// <summary>
    /// Selects option legs based on <paramref name="strikeOffset"/>.
    /// 0 = straddle: ATM CE + ATM PE (same strike).
    /// N = strangle: CE is N strikes above ATM, PE is N strikes below ATM.
    /// Returns null when the chain is empty, offset is out of range, or either key is missing.
    /// </summary>
    internal static (decimal AtmStrike, decimal CeStrike, decimal PeStrike, string Ce, string Pe)? Select(
        IReadOnlyList<OptionChainEntry> chain, decimal spot, int strikeOffset)
    {
        if (chain.Count == 0 || strikeOffset < 0) return null;

        var sorted  = chain.OrderBy(e => e.StrikePrice).ToList();
        var atmEntry = sorted
            .OrderBy(e => Math.Abs(e.StrikePrice - spot))
            .ThenByDescending(e => e.StrikePrice)
            .First();
        var atmIdx = sorted.IndexOf(atmEntry);

        var ceIdx = atmIdx + strikeOffset;
        var peIdx = atmIdx - strikeOffset;

        if (ceIdx >= sorted.Count || peIdx < 0) return null;

        var ceEntry = sorted[ceIdx];
        var peEntry = sorted[peIdx];

        return ceEntry.CallOptions?.InstrumentKey is { Length: > 0 } ce
            && peEntry.PutOptions?.InstrumentKey  is { Length: > 0 } pe
            ? (atmEntry.StrikePrice, ceEntry.StrikePrice, peEntry.StrikePrice, ce, pe)
            : null;
    }
}
