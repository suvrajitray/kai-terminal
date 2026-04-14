namespace KAITerminal.RiskEngine.Models;

/// <summary>
/// Per-user mutable risk state held in memory for the duration of the process.
/// </summary>
public sealed class UserRiskState
{
    // ── Session tracking ────────────────────────────────────────────────────
    /// <summary>Trading date when this state was last initialised.
    /// Guards against a forgotten daily restart carrying stale state into a new session.</summary>
    public DateOnly LastResetDate { get; set; }

    // ── Portfolio ───────────────────────────────────────────────────────────
    /// <summary>True once a portfolio-level trigger fires and positions are squared off.</summary>
    public bool IsSquaredOff { get; set; }

    // ── Trailing stop loss ──────────────────────────────────────────────────
    public bool    TrailingActive      { get; set; }
    public decimal TrailingStop        { get; set; }
    /// <summary>The MTM value at the point the trailing stop was last moved up.</summary>
    public decimal TrailingLastTrigger { get; set; }

    // ── Strike re-entry counts ──────────────────────────────────────────────
    private readonly Dictionary<string, int> _reentryCounts = new(StringComparer.Ordinal);

    /// <summary>Keyed by trading symbol (e.g. "NIFTY25JAN2323000CE"). Value = number of re-entries used.</summary>
    public IReadOnlyDictionary<string, int> ReentryCounts => _reentryCounts;

    public int IncrementReentryCount(string symbol)
    {
        _reentryCounts.TryGetValue(symbol, out var current);
        var next = current + 1;
        _reentryCounts[symbol] = next;
        return next;
    }

    // ── Auto-shift counts ────────────────────────────────────────────────────
    /// <summary>
    /// Tracks how many auto-shifts have been performed per original position leg.
    /// Key format: "{underlying}_{expiry}_{optionType}_{strike}" e.g. "NIFTY_2026-04-17_PE_22000".
    /// </summary>
    private readonly Dictionary<string, int> _autoShiftCounts = new(StringComparer.Ordinal);

    public IReadOnlyDictionary<string, int> AutoShiftCounts => _autoShiftCounts;

    public int IncrementAutoShiftCount(string chainKey)
    {
        _autoShiftCounts.TryGetValue(chainKey, out var current);
        var next = current + 1;
        _autoShiftCounts[chainKey] = next;
        return next;
    }

    // ── Auto-shift origin map ─────────────────────────────────────────────────
    /// <summary>
    /// Maps an instrument token to the chain key of the original position it was shifted from.
    /// Key: instrument token of the shifted-into position.
    /// Value: chain key (format: "{underlying}_{expiry}_{type}_{strike}").
    /// </summary>
    private readonly Dictionary<string, string> _shiftOriginMap = new(StringComparer.Ordinal);

    public IReadOnlyDictionary<string, string> ShiftOriginMap => _shiftOriginMap;

    public void MapShiftOrigin(string newToken, string originalChainKey) =>
        _shiftOriginMap[newToken] = originalChainKey;

    // ── Exhausted-exit guard ──────────────────────────────────────────────────
    /// <summary>
    /// Chain keys for which an exhausted-exit order has already been placed this session.
    /// Prevents duplicate exit orders on repeated ticks before the next position poll.
    /// </summary>
    private readonly HashSet<string> _exitedChainKeys = new(StringComparer.Ordinal);

    public IReadOnlySet<string> ExitedChainKeys => _exitedChainKeys;

    public void MarkChainExited(string chainKey) => _exitedChainKeys.Add(chainKey);

    public UserRiskState Clone()
    {
        var copy = new UserRiskState
        {
            LastResetDate = LastResetDate,
            IsSquaredOff = IsSquaredOff,
            TrailingActive = TrailingActive,
            TrailingStop = TrailingStop,
            TrailingLastTrigger = TrailingLastTrigger,
        };

        foreach (var (key, value) in _reentryCounts)
            copy._reentryCounts[key] = value;
        foreach (var (key, value) in _autoShiftCounts)
            copy._autoShiftCounts[key] = value;
        foreach (var (key, value) in _shiftOriginMap)
            copy._shiftOriginMap[key] = value;
        foreach (var key in _exitedChainKeys)
            copy._exitedChainKeys.Add(key);

        return copy;
    }
}
