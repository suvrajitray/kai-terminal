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
        public readonly ConcurrentDictionary<string, decimal> Ltp = new(StringComparer.Ordinal);
        // Tokens shifted/exited this poll cycle; prevents re-triggering on subsequent LTP ticks.
        // Cleared on every UpdatePositions call.
        public readonly ConcurrentDictionary<string, bool> ShiftedTokens = new(StringComparer.Ordinal);
    }

    private Entry GetOrAdd(string userId) => _data.GetOrAdd(userId, _ => new Entry());

    public void UpdatePositions(string userId, IReadOnlyList<BrokerPosition> positions)
    {
        var entry = GetOrAdd(userId);

        // Evict LTP for tokens that have left the position list entirely.
        // Keeping LTP for tokens still present means open positions retain their
        // last live tick across polls — no stale-value dip on every refresh.
        var incoming = new HashSet<string>(StringComparer.Ordinal);
        foreach (var p in positions)
            if (!string.IsNullOrEmpty(p.InstrumentToken))
                incoming.Add(p.InstrumentToken);

        foreach (var key in entry.Ltp.Keys.ToList())
            if (!incoming.Contains(key))
                entry.Ltp.TryRemove(key, out _);

        // New poll cycle — clear the shifted-token guard set
        entry.ShiftedTokens.Clear();

        entry.Positions = positions;
    }

    public void UpdateLtp(string userId, string instrumentToken, decimal ltp)
    {
        if (ltp <= 0) return;
        GetOrAdd(userId).Ltp[instrumentToken] = ltp;
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
            // Closed positions always use the broker's P&L — never LTP.
            // Open positions with a live LTP tick: start from the broker's own verified
            // p.Pnl and apply only the incremental price delta since the last REST poll.
            // This avoids issues with blended average-price in NET positions where the
            // same instrument was traded multiple times intraday (e.g. exit + re-entry).
            // Fall back to p.Pnl when no LTP tick has arrived yet.
            if (p.IsOpen && e.Ltp.TryGetValue(p.InstrumentToken, out var ltp))
                total += p.Pnl + p.Quantity * (ltp - p.Ltp);
            else
                total += p.Pnl;
        }
        return total;
    }

    public void ResetLtp(string userId)
    {
        if (_data.TryGetValue(userId, out var e))
            e.Ltp.Clear();
    }

    public IReadOnlyList<string> GetOpenInstrumentTokens(string userId)
    {
        if (!_data.TryGetValue(userId, out var e)) return [];
        return e.Positions
            .Where(p => p.IsOpen && !string.IsNullOrEmpty(p.InstrumentToken))
            .Select(p => p.InstrumentToken)
            .ToList();
    }

    public void MarkShifted(string userId, string instrumentToken)
        => GetOrAdd(userId).ShiftedTokens[instrumentToken] = true;

    public bool IsShifted(string userId, string instrumentToken)
        => _data.TryGetValue(userId, out var e) && e.ShiftedTokens.ContainsKey(instrumentToken);
}
