using System.Collections.Concurrent;
using KAITerminal.Contracts.Domain;
using KAITerminal.RiskEngine.Abstractions;

namespace KAITerminal.RiskEngine.State;

/// <summary>Thread-safe per-user position and LTP cache.</summary>
public sealed class PositionCache : IPositionCache
{
    private readonly ConcurrentDictionary<string, Entry> _data = new(StringComparer.Ordinal);

    private sealed class Entry
    {
        // Written atomically; readers always see a consistent snapshot
        public volatile IReadOnlyList<BrokerPosition> Positions = [];
        public readonly ConcurrentDictionary<string, decimal> Ltp     = new(StringComparer.Ordinal);
        // Last accepted feed LTP per instrument — used to sanity-check incoming ticks
        public readonly ConcurrentDictionary<string, decimal> PrevLtp = new(StringComparer.Ordinal);
    }

    private Entry GetOrAdd(string userId) => _data.GetOrAdd(userId, _ => new Entry());

    public void UpdatePositions(string userId, IReadOnlyList<BrokerPosition> positions)
    {
        var entry = GetOrAdd(userId);
        entry.Ltp.Clear();
        entry.PrevLtp.Clear();

        // Seed PrevLtp from AveragePrice (entry price — always reliable) so the very
        // first feed tick after a poll has a sane baseline. We deliberately avoid p.Ltp
        // because brokers (e.g. Zerodha) can return a very stale last_price.
        foreach (var p in positions)
        {
            if (!string.IsNullOrEmpty(p.InstrumentToken) && p.AveragePrice > 0)
                entry.PrevLtp[p.InstrumentToken] = p.AveragePrice;
        }

        entry.Positions = positions;
    }

    public void UpdateLtp(string userId, string instrumentToken, decimal ltp)
    {
        if (ltp <= 0) return;   // always reject zero / negative ticks

        var entry = GetOrAdd(userId);

        // Sanity-check against the previous accepted feed LTP for this instrument.
        // Genuine price moves happen across consecutive ticks; an erroneous spike is a
        // single outlier tick that immediately reverts. Reject if > 10x or < 10% of last
        // accepted tick. On first tick (no baseline yet) accept unconditionally.
        if (entry.PrevLtp.TryGetValue(instrumentToken, out var prev) && prev > 0)
        {
            var ratio = ltp / prev;
            if (ratio is < 0.1m or > 10m) return;  // outlier — discard
        }

        entry.PrevLtp[instrumentToken] = ltp;
        entry.Ltp[instrumentToken]     = ltp;
    }

    public IReadOnlyList<BrokerPosition> GetPositions(string userId)
        => _data.TryGetValue(userId, out var e) ? e.Positions : [];

    public decimal GetEffectiveLtp(string userId, string instrumentToken, decimal fallback)
    {
        if (_data.TryGetValue(userId, out var e) && e.Ltp.TryGetValue(instrumentToken, out var ltp))
            return ltp;
        return fallback;
    }

    public decimal? TryGetLiveLtp(string userId, string instrumentToken)
    {
        if (_data.TryGetValue(userId, out var e) && e.Ltp.TryGetValue(instrumentToken, out var ltp))
            return ltp;
        return null;
    }

    public decimal GetMtm(string userId)
    {
        if (!_data.TryGetValue(userId, out var e)) return 0m;

        decimal total = 0m;
        foreach (var p in e.Positions)
        {
            if (e.Ltp.TryGetValue(p.InstrumentToken, out var ltp))
                // Live LTP available: compute from AveragePrice (entry price — always reliable).
                // Avoids dependence on p.Ltp which brokers (e.g. Zerodha) may return stale.
                // p.Quantity * (ltp - avg) = correct live PnL for both long and short positions.
                total += p.Quantity * (ltp - p.AveragePrice);
            else
                total += p.Pnl;  // no live tick yet — fall back to broker REST PnL
        }
        return total;
    }

    public IReadOnlyList<string> GetOpenInstrumentTokens(string userId)
    {
        if (!_data.TryGetValue(userId, out var e)) return [];
        return e.Positions
            .Where(p => p.IsOpen && !string.IsNullOrEmpty(p.InstrumentToken))
            .Select(p => p.InstrumentToken)
            .ToList();
    }

    public void RemovePosition(string userId, string instrumentToken)
    {
        if (!_data.TryGetValue(userId, out var e)) return;
        e.Positions = e.Positions
            .Where(p => !string.Equals(p.InstrumentToken, instrumentToken, StringComparison.Ordinal))
            .ToList()
            .AsReadOnly();
        e.Ltp.TryRemove(instrumentToken, out _);
    }
}
