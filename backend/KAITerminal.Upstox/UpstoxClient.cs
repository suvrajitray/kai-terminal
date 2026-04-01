using KAITerminal.Broker;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;
using BrokerFunds = KAITerminal.Contracts.Domain.BrokerFunds;
using BrokerMarginOrderItem = KAITerminal.Contracts.Domain.BrokerMarginOrderItem;
using BrokerMarginResult = KAITerminal.Contracts.Domain.BrokerMarginResult;
using BrokerPosition = KAITerminal.Contracts.Domain.BrokerPosition;

namespace KAITerminal.Upstox;

/// <summary>
/// High-level facade that consolidates all Upstox SDK features under a single entry point.
/// Can be injected directly or resolved from the DI container after calling
/// <c>services.AddUpstoxSdk()</c>.
/// </summary>
public sealed class UpstoxClient
{
    private readonly IBrokerAuthService     _auth;
    private readonly IBrokerPositionService _positions;
    private readonly IBrokerOrderService    _orders;
    private readonly IBrokerMarginService   _margin;
    private readonly IBrokerFundsService    _funds;
    private readonly UpstoxHttpClient       _http;

    internal UpstoxClient(
        IBrokerAuthService     auth,
        IBrokerPositionService positions,
        IBrokerOrderService    orders,
        IBrokerMarginService   margin,
        IBrokerFundsService    funds,
        UpstoxHttpClient       http)
    {
        ArgumentNullException.ThrowIfNull(auth);
        ArgumentNullException.ThrowIfNull(positions);
        ArgumentNullException.ThrowIfNull(orders);
        ArgumentNullException.ThrowIfNull(margin);
        ArgumentNullException.ThrowIfNull(funds);
        ArgumentNullException.ThrowIfNull(http);

        _auth      = auth;
        _positions = positions;
        _orders    = orders;
        _margin    = margin;
        _funds     = funds;
        _http      = http;
    }

    // ═══════════════════════════════════════════════════════
    // Feature 0 — Token Generation
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Exchanges an Upstox authorization code for an access token.
    /// Obtain the code by redirecting the user to the Upstox login page and capturing
    /// the <c>code</c> query parameter from the redirect callback.
    /// </summary>
    /// <param name="clientId">API key from the Upstox developer console.</param>
    /// <param name="clientSecret">API secret from the Upstox developer console.</param>
    /// <param name="authorizationCode">The <c>code</c> received in the OAuth callback.</param>
    /// <param name="redirectUri">Redirect URI registered in the Upstox developer console.</param>
    public Task<string> GenerateTokenAsync(
        string clientId,
        string clientSecret,
        string authorizationCode,
        string? redirectUri = null,
        CancellationToken cancellationToken = default)
        => _auth.GenerateTokenAsync(clientId, clientSecret, authorizationCode, redirectUri, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 1 — Get All Positions
    // ═══════════════════════════════════════════════════════

    /// <summary>Fetch all open and closed positions for the current trading day.</summary>
    public Task<IReadOnlyList<BrokerPosition>> GetAllPositionsAsync(
        CancellationToken cancellationToken = default)
        => _positions.GetAllPositionsAsync(cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 2 — Get Total MTM
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Calculate real-time total MTM across all positions.
    /// Returns the sum of each position's total P&amp;L (realised + unrealised).
    /// </summary>
    public Task<decimal> GetTotalMtmAsync(CancellationToken cancellationToken = default)
        => _positions.GetTotalMtmAsync(cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 3 — Exit All Positions
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Square off every open position immediately.
    /// Places opposing orders concurrently for all positions with non-zero quantity.
    /// </summary>
    /// <returns>List of exit order IDs.</returns>
    public Task<IReadOnlyList<string>> ExitAllPositionsAsync(
        IReadOnlyCollection<string>? exchanges = null,
        CancellationToken cancellationToken = default)
        => _positions.ExitAllPositionsAsync(exchanges, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 4 — Exit Single Position
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Square off a single specified position by instrument token.
    /// </summary>
    /// <param name="instrumentToken">e.g. "NSE_FO|52618"</param>
    public Task<string> ExitPositionAsync(
        string instrumentToken,
        string product,
        CancellationToken cancellationToken = default)
        => _positions.ExitPositionAsync(instrumentToken, product, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 5 — Convert Position
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Convert a position between Intraday ("I") and Delivery ("D") product types.
    /// </summary>
    /// <param name="instrumentToken">e.g. "NSE_FO|52618"</param>
    /// <param name="oldProduct">Current product: "I" or "D".</param>
    /// <param name="quantity">Units to convert (positive integer).</param>
    public Task ConvertPositionAsync(
        string instrumentToken,
        string oldProduct,
        int quantity,
        CancellationToken cancellationToken = default)
        => _positions.ConvertPositionAsync(instrumentToken, oldProduct, quantity, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 6 — Cancel All Pending Orders
    // ═══════════════════════════════════════════════════════

    /// <summary>Cancel every open / pending order in the order book.</summary>
    /// <returns>List of cancelled order IDs.</returns>
    public Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(
        CancellationToken cancellationToken = default)
        => _orders.CancelAllPendingOrdersAsync(cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 6 — Place Order
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Place a standard order (v3 HFT endpoint).
    /// Returns one or more order IDs (multiple when auto-sliced) and API latency in ms.
    /// </summary>
    public Task<PlaceOrderV3Result> PlaceOrderV3Async(
        PlaceOrderRequest request, CancellationToken cancellationToken = default)
        => _http.PlaceOrderV3Async(request, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Additional helpers exposed for convenience
    // ═══════════════════════════════════════════════════════

    /// <summary>Retrieve all orders placed during the current trading day.</summary>
    public Task<IReadOnlyList<Order>> GetAllOrdersAsync(
        CancellationToken cancellationToken = default)
        => _http.GetAllOrdersAsync(cancellationToken);

    /// <summary>Cancel a single order by ID (v3 HFT). Returns order ID and latency in ms.</summary>
    public Task<(string OrderId, int Latency)> CancelOrderV3Async(
        string orderId, CancellationToken cancellationToken = default)
        => _http.CancelOrderV3Async(orderId, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Margin
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Calculate required margin for a set of hypothetical orders without placing them.
    /// </summary>
    public Task<BrokerMarginResult> GetRequiredMarginAsync(
        IEnumerable<BrokerMarginOrderItem> items, CancellationToken cancellationToken = default)
        => _margin.GetRequiredMarginAsync(items, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Funds
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Returns available margin, used margin, and payin amount for the equity/F&amp;O segment.
    /// </summary>
    public Task<BrokerFunds> GetFundsAsync(CancellationToken cancellationToken = default)
        => _funds.GetFundsAsync(cancellationToken);
}
