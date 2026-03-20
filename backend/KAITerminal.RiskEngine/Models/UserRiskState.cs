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
    private readonly Dictionary<string, int> _reentryCounts = new(StringComparer.Ordinal);

    /// <summary>Keyed by trading symbol (e.g. "NIFTY25JAN2323000CE"). Value = number of re-entries used.</summary>
    public IReadOnlyDictionary<string, int> ReentryCounts => _reentryCounts;

    /// <summary>Increments the re-entry count for the given symbol and returns the new value.</summary>
    public int IncrementReentryCount(string symbol)
    {
        _reentryCounts.TryGetValue(symbol, out var current);
        var next = current + 1;
        _reentryCounts[symbol] = next;
        return next;
    }
}
