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
    /// Computes total MTM using cached positions and live LTP values.
    /// Formula per position: <c>pnl + quantity * (liveLtp - ltp)</c>.
    /// </summary>
    decimal GetMtm(string userId);

    /// <summary>Returns instrument tokens of all open positions (quantity != 0).</summary>
    IReadOnlyList<string> GetOpenInstrumentTokens(string userId);
}
