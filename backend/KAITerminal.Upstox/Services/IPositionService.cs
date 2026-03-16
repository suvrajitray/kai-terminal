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
    /// When <paramref name="exchanges"/> is provided, only positions on those exchanges are exited.
    /// </summary>
    /// <returns>List of order IDs created for the exits.</returns>
    Task<IReadOnlyList<string>> ExitAllPositionsAsync(
        IReadOnlyCollection<string>? exchanges = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 4 — Square off a single specified position.
    /// Both <paramref name="instrumentToken"/> and <paramref name="product"/> are required
    /// because the same instrument can have separate intraday and delivery positions.
    /// </summary>
    /// <param name="instrumentToken">Instrument key, e.g. "NSE_FO|52618".</param>
    /// <param name="product">Upstox product string: "I", "D", "MTF", "CO".</param>
    Task<string> ExitPositionAsync(
        string instrumentToken,
        string product,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 5 — Convert a position between Intraday and Delivery product types.
    /// </summary>
    /// <param name="instrumentToken">Instrument key, e.g. "NSE_FO|52618".</param>
    /// <param name="oldProduct">Current product string: "I" or "D".</param>
    /// <param name="quantity">Number of units to convert (positive).</param>
    Task ConvertPositionAsync(
        string instrumentToken,
        string oldProduct,
        int quantity,
        CancellationToken cancellationToken = default);
}
