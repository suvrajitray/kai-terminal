using KAITerminal.Contracts.Options;

namespace KAITerminal.RollingStraddle.Logic;

internal static class AtmSelector
{
    /// <summary>
    /// Selects the ATM strike closest to <paramref name="spot"/>.
    /// Returns null when the chain is empty or either instrument key is missing.
    /// </summary>
    internal static (decimal Strike, string Ce, string Pe)? Select(
        IReadOnlyList<OptionChainEntry> chain, decimal spot)
    {
        if (chain.Count == 0) return null;

        var atm = chain
            .OrderBy(e => Math.Abs(e.StrikePrice - spot))
            .ThenByDescending(e => e.StrikePrice)
            .First();

        return atm.CallOptions?.InstrumentKey is { Length: > 0 } ce
            && atm.PutOptions?.InstrumentKey  is { Length: > 0 } pe
            ? (atm.StrikePrice, ce, pe)
            : null;
    }
}
