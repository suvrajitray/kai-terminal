using System.Text.Json.Serialization;

namespace KAITerminal.RiskEngine.Models;

/// <summary>
/// Per-user mutable risk state held in memory for the duration of the process.
/// </summary>
public sealed class UserRiskState
{
    // ── Session tracking ────────────────────────────────────────────────────
    /// <summary>Calendar date (trading timezone) when this state was last initialised.
    /// Used to detect a new trading day so stale state is discarded on Worker restart.</summary>
    public DateOnly LastSessionDate { get; set; }

    // ── Portfolio ───────────────────────────────────────────────────────────
    /// <summary>True once a portfolio-level trigger fires and positions are squared off.</summary>
    public bool IsSquaredOff { get; set; }

    // ── Trailing stop loss ──────────────────────────────────────────────────
    public bool TrailingActive { get; set; }
    public decimal TrailingStop { get; set; }
    /// <summary>The MTM value at the point the trailing stop was last moved up.</summary>
    public decimal TrailingLastTrigger { get; set; }

    // ── Strike re-entry counts ──────────────────────────────────────────────
    [JsonInclude]
    public Dictionary<string, int> ReentryCountsData { get; private set; } = new(StringComparer.Ordinal);

    /// <summary>Keyed by trading symbol (e.g. "NIFTY25JAN2323000CE"). Value = number of re-entries used.</summary>
    [JsonIgnore]
    public IReadOnlyDictionary<string, int> ReentryCounts => ReentryCountsData;

    /// <summary>Increments the re-entry count for the given symbol and returns the new value.</summary>
    public int IncrementReentryCount(string symbol)
    {
        ReentryCountsData.TryGetValue(symbol, out var current);
        var next = current + 1;
        ReentryCountsData[symbol] = next;
        return next;
    }

    // ── Auto-shift counts ────────────────────────────────────────────────────
    /// <summary>
    /// Tracks how many auto-shifts have been performed per original position leg.
    /// Key format: "{underlying}_{expiry}_{optionType}_{strike}" e.g. "NIFTY_2026-04-17_PE_22000".
    /// Each original leg has its own independent counter so multiple shorts of the same
    /// type/expiry do not share a shift pool.
    /// </summary>
    [JsonInclude]
    public Dictionary<string, int> AutoShiftCountsData { get; private set; } = new(StringComparer.Ordinal);

    [JsonIgnore]
    public IReadOnlyDictionary<string, int> AutoShiftCounts => AutoShiftCountsData;

    public int IncrementAutoShiftCount(string chainKey)
    {
        AutoShiftCountsData.TryGetValue(chainKey, out var current);
        var next = current + 1;
        AutoShiftCountsData[chainKey] = next;
        return next;
    }

    // ── Auto-shift origin map ─────────────────────────────────────────────────
    /// <summary>
    /// Maps an instrument token to the chain key of the original position it was shifted from.
    /// Allows the shift counter to follow a position across strike changes while keeping
    /// each original leg's allowance independent.
    /// Key: instrument token of the shifted-into position.
    /// Value: originalChainKey (format: "{underlying}_{expiry}_{type}_{strike}").
    /// </summary>
    [JsonInclude]
    public Dictionary<string, string> ShiftOriginMapData { get; private set; } = new(StringComparer.Ordinal);

    [JsonIgnore]
    public IReadOnlyDictionary<string, string> ShiftOriginMap => ShiftOriginMapData;

    public void MapShiftOrigin(string newToken, string originalChainKey) =>
        ShiftOriginMapData[newToken] = originalChainKey;

    // ── Exhausted-exit guard ──────────────────────────────────────────────────
    /// <summary>
    /// Chain keys for which an exhausted-exit order has already been placed this session.
    /// Prevents duplicate exit orders being fired on repeated ticks before the position
    /// poll updates the cache (market orders typically fill in &lt;1 s, but this is a safety guard).
    /// </summary>
    [JsonInclude]
    public HashSet<string> ExitedChainKeysData { get; private set; } = new(StringComparer.Ordinal);

    [JsonIgnore]
    public IReadOnlySet<string> ExitedChainKeys => ExitedChainKeysData;

    public void MarkChainExited(string chainKey) => ExitedChainKeysData.Add(chainKey);
}
