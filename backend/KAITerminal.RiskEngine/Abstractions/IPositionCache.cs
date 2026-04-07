using KAITerminal.Contracts.Domain;

namespace KAITerminal.RiskEngine.Abstractions;

/// <summary>
/// Per-user in-memory cache of positions and live LTP values.
/// Updated by <c>StreamingRiskWorker</c> from WebSocket events.
/// </summary>
public interface IPositionCache
{
    /// <summary>Replace the full position list for a user (called after each REST fetch).</summary>
    void UpdatePositions(string userId, IReadOnlyList<BrokerPosition> positions);

    /// <summary>Update a single instrument's LTP (called on every market data tick).</summary>
    void UpdateLtp(string userId, string instrumentToken, decimal ltp);

    /// <summary>Returns the cached positions for a user (empty list if not yet populated).</summary>
    IReadOnlyList<BrokerPosition> GetPositions(string userId);

    /// <summary>
    /// Returns the live LTP for an instrument if available, otherwise <paramref name="fallback"/>.
    /// </summary>
    decimal GetEffectiveLtp(string userId, string instrumentToken, decimal fallback);

    /// <summary>
    /// Returns the live feed LTP for an instrument, or null if no validated tick has arrived yet.
    /// Use this when falling back to stale broker data would produce incorrect results.
    /// </summary>
    decimal? TryGetLiveLtp(string userId, string instrumentToken);

    /// <summary>
    /// Computes total MTM from the last REST poll, enhanced with live LTP for open positions.
    /// Open positions with a live LTP tick: <c>quantity × (ltp − avgPrice)</c>.
    /// Closed positions and open positions awaiting their first tick: broker's <c>p.Pnl</c>.
    /// </summary>
    decimal GetMtm(string userId);

    /// <summary>Returns instrument tokens of all open positions (quantity != 0).</summary>
    IReadOnlyList<string> GetOpenInstrumentTokens(string userId);

    /// <summary>
    /// Marks a token as shifted/exited this poll cycle so subsequent LTP ticks do not
    /// re-trigger auto-shift before the next REST poll refreshes positions.
    /// Cleared automatically on the next <see cref="UpdatePositions"/> call.
    /// </summary>
    void MarkShifted(string userId, string instrumentToken);

    /// <summary>Returns true if the token was marked shifted this poll cycle.</summary>
    bool IsShifted(string userId, string instrumentToken);
}
