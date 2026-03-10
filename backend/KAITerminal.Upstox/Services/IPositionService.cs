using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

/// <summary>
/// Provides position management and MTM operations (Features 1–4).
/// </summary>
public interface IPositionService
{
    /// <summary>Feature 1 — Fetch all open and closed positions for the current day.</summary>
    Task<IReadOnlyList<Position>> GetAllPositionsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 2 — Calculate total MTM across all positions.
    /// Returns the sum of <see cref="Position.Pnl"/> (realised + unrealised).
    /// </summary>
    Task<decimal> GetTotalMtmAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 3 — Square off every open position immediately.
    /// Places an opposing order (SELL for long, BUY for short) for each position with non-zero quantity.
    /// </summary>
    /// <returns>List of order IDs created for the exits.</returns>
    Task<IReadOnlyList<string>> ExitAllPositionsAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 4 — Square off a single specified position.
    /// Product type is derived from the position itself.
    /// </summary>
    /// <param name="instrumentToken">Instrument key of the position to exit, e.g. "NSE_FO|52618".</param>
    /// <returns>The order ID created for the exit.</returns>
    Task<string> ExitPositionAsync(
        string instrumentToken,
        CancellationToken cancellationToken = default);
}
