using System.Collections.Concurrent;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.RiskEngine.State;

/// <summary>Thread-safe per-user position and LTP cache.</summary>
public sealed class PositionCache : IPositionCache
{
    private readonly ConcurrentDictionary<string, Entry> _data = new(StringComparer.Ordinal);

    private sealed class Entry
    {
        // Written atomically; readers always see a consistent snapshot
        public volatile IReadOnlyList<Position> Positions = [];
        public readonly ConcurrentDictionary<string, decimal> Ltp = new(StringComparer.Ordinal);
    }

    private Entry GetOrAdd(string userId) => _data.GetOrAdd(userId, _ => new Entry());

    public void UpdatePositions(string userId, IReadOnlyList<Position> positions)
        => GetOrAdd(userId).Positions = positions;

    public void UpdateLtp(string userId, string instrumentToken, decimal ltp)
        => GetOrAdd(userId).Ltp[instrumentToken] = ltp;

    public IReadOnlyList<Position> GetPositions(string userId)
        => _data.TryGetValue(userId, out var e) ? e.Positions : [];

    public decimal GetEffectiveLtp(string userId, string instrumentToken, decimal fallback)
    {
        if (_data.TryGetValue(userId, out var e) && e.Ltp.TryGetValue(instrumentToken, out var ltp))
            return ltp;
        return fallback;
    }

    public decimal GetMtm(string userId)
    {
        if (!_data.TryGetValue(userId, out var e)) return 0m;

        decimal total = 0m;
        foreach (var p in e.Positions)
        {
            var ltp = e.Ltp.TryGetValue(p.InstrumentToken, out var v) ? v : p.LastPrice;
            total += p.Quantity * (ltp - p.AveragePrice) + p.Realised;
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
}
