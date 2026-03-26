using KAITerminal.Contracts.Options;

namespace KAITerminal.Api.Services;

/// <summary>
/// Fetches the option chain and selects the best strike for a shift-up or shift-down operation.
/// Broker-agnostic — returns the Upstox <c>InstrumentKey</c>; the calling endpoint maps it to
/// the broker-specific token before placing orders.
/// </summary>
public sealed class ShiftService(IOptionChainProvider chain)
{
    /// <summary>
    /// Returns the Upstox <c>InstrumentKey</c> of the best-matching strike.
    /// Shift-up: cheapest option at or above <paramref name="targetPremium"/>.
    /// Shift-down: most expensive option at or below <paramref name="targetPremium"/>.
    /// Falls back to the nearest strike when no eligible candidate exists.
    /// Returns <c>null</c> when the chain is empty or no LTP data is available.
    /// </summary>
    public async Task<string?> FindTargetStrikeAsync(
        string underlyingKey,
        string expiry,
        string instrumentType,
        decimal targetPremium,
        string direction,
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

        var isUp = direction.Equals("up", StringComparison.OrdinalIgnoreCase);

        // Preferred: strictly eligible candidates sorted toward target
        var eligible = isUp
            ? candidates.Where(c => c.Ltp >= targetPremium).OrderBy(c => c.Ltp).ToList()
            : candidates.Where(c => c.Ltp <= targetPremium).OrderByDescending(c => c.Ltp).ToList();

        if (eligible.Count > 0) return eligible[0].Key;

        // Fallback: nearest strike by absolute LTP distance
        return candidates.MinBy(c => Math.Abs(c.Ltp - targetPremium)).Key;
    }
}
