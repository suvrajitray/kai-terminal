using KAITerminal.Contracts.Options;

namespace KAITerminal.Api.Services;

/// <summary>
/// Fetches the option chain and selects the best strike for a shift or by-price order.
/// Broker-agnostic — always returns an Upstox <c>InstrumentKey</c>; the calling endpoint maps
/// it to the broker-specific token before placing orders.
/// </summary>
public sealed class OptionStrikeService(IOptionChainProvider chain)
{
    /// <summary>
    /// Returns the Upstox <c>InstrumentKey</c> <paramref name="strikeGap"/> steps away from
    /// <paramref name="currentStrike"/> in the sorted option chain.
    /// Positive <paramref name="strikeGap"/> moves toward higher strikes; negative moves lower.
    /// The result is clamped to the first/last valid entry.
    /// Returns <c>null</c> when the chain is empty or has no tradable entries.
    /// </summary>
    public async Task<string?> FindByStrikeGapAsync(
        string underlyingKey,
        string expiry,
        string instrumentType,
        decimal currentStrike,
        int strikeGap,
        CancellationToken ct = default)
    {
        var entries = await chain.GetChainAsync(underlyingKey, expiry, ct);

        var isCe = instrumentType.Equals("CE", StringComparison.OrdinalIgnoreCase);

        var sides = entries
            .Select(e => new { e.StrikePrice, Side = isCe ? e.CallOptions : e.PutOptions })
            .Where(x => x.Side is not null && !string.IsNullOrEmpty(x.Side.InstrumentKey))
            .OrderBy(x => x.StrikePrice)
            .ToList();

        if (sides.Count == 0) return null;

        // Find the entry whose strike is closest to currentStrike
        var currentIdx = sides
            .Select((x, i) => (i, diff: Math.Abs(x.StrikePrice - currentStrike)))
            .MinBy(t => t.diff).i;

        var targetIdx = Math.Clamp(currentIdx + strikeGap, 0, sides.Count - 1);
        return sides[targetIdx].Side!.InstrumentKey;
    }

    /// <summary>
    /// Returns the Upstox <c>InstrumentKey</c> whose LTP is closest to <paramref name="targetPremium"/>.
    /// Used by the "by option price" quick trade endpoint.
    /// Returns <c>null</c> when the chain is empty or no LTP data is available.
    /// </summary>
    public async Task<string?> FindByPriceAsync(
        string underlyingKey,
        string expiry,
        string instrumentType,
        decimal targetPremium,
        CancellationToken ct = default)
    {
        var entries = await chain.GetChainAsync(underlyingKey, expiry, ct);

        var isCe = instrumentType.Equals("CE", StringComparison.OrdinalIgnoreCase);

        var candidates = entries
            .Select(e => isCe ? e.CallOptions : e.PutOptions)
            .Where(s => s is not null && s.MarketData is not null && !string.IsNullOrEmpty(s.InstrumentKey))
            .Select(s => (Key: s!.InstrumentKey, Ltp: s.MarketData!.Ltp))
            .ToList();

        if (candidates.Count == 0) return null;

        return candidates.MinBy(c => Math.Abs(c.Ltp - targetPremium)).Key;
    }
}
