using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

/// <summary>
/// Provides option chain queries and advanced option-based order placement (Features 7–8).
/// </summary>
public interface IOptionService
{
    /// <summary>
    /// Fetch the full put/call option chain for an underlying at a given expiry.
    /// Each entry in the list represents one strike with both CE and PE sides.
    /// </summary>
    /// <param name="underlyingKey">e.g. "NSE_INDEX|Nifty 50"</param>
    /// <param name="expiryDate">YYYY-MM-DD, e.g. "2024-03-28"</param>
    Task<IReadOnlyList<OptionChainEntry>> GetOptionChainAsync(
        string underlyingKey,
        string expiryDate,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Fetch individual option contracts (metadata only, no live prices) for an underlying.
    /// Useful for enumerating available expiries and strikes.
    /// </summary>
    Task<IReadOnlyList<OptionContract>> GetOptionContractsAsync(
        string underlyingKey,
        string? expiryDate = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 7 (preview) — Resolve the strike that would be selected by
    /// <see cref="PlaceOrderByOptionPriceAsync"/> and return the order record without placing it.
    /// </summary>
    Task<PlaceOrderRequest> GetOrderByOptionPriceAsync(
        PlaceOrderByOptionPriceRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 7 — Find the strike whose current LTP is nearest to the target premium
    /// and place a v2 order on it.
    /// </summary>
    Task<PlaceOrderResult> PlaceOrderByOptionPriceAsync(
        PlaceOrderByOptionPriceRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 7 (v3) — Find the strike whose current LTP is nearest to the target premium
    /// and place a v3 HFT order on it (supports auto-slicing).
    /// </summary>
    Task<PlaceOrderV3Result> PlaceOrderByOptionPriceV3Async(
        PlaceOrderByOptionPriceRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 8 (preview) — Resolve the strike that would be selected by
    /// <see cref="PlaceOrderByStrikeAsync"/> and return the order record without placing it.
    /// </summary>
    Task<PlaceOrderRequest> GetOrderByStrikeAsync(
        PlaceOrderByStrikeRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 8 — Resolve the exact strike by relative type (ATM / OTMn / ITMn)
    /// and place a v2 order on it.
    /// </summary>
    Task<PlaceOrderResult> PlaceOrderByStrikeAsync(
        PlaceOrderByStrikeRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Feature 8 (v3) — Resolve the exact strike by relative type (ATM / OTMn / ITMn)
    /// and place a v3 HFT order on it (supports auto-slicing).
    /// </summary>
    Task<PlaceOrderV3Result> PlaceOrderByStrikeV3Async(
        PlaceOrderByStrikeRequest request,
        CancellationToken cancellationToken = default);
}
