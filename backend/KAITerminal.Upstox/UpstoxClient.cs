using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Upstox.Services;

namespace KAITerminal.Upstox;

/// <summary>
/// High-level facade that consolidates all Upstox SDK features under a single entry point.
/// Can be injected directly or resolved from the DI container after calling
/// <c>services.AddUpstoxSdk()</c>.
/// </summary>
public sealed class UpstoxClient
{
    private readonly IPositionService _positions;
    private readonly IOrderService _orders;
    private readonly IOptionService _options;
    private readonly Func<IMarketDataStreamer> _marketDataStreamerFactory;
    private readonly Func<IPortfolioStreamer> _portfolioStreamerFactory;

    public UpstoxClient(
        IPositionService positions,
        IOrderService orders,
        IOptionService options,
        Func<IMarketDataStreamer> marketDataStreamerFactory,
        Func<IPortfolioStreamer> portfolioStreamerFactory)
    {
        _positions = positions;
        _orders = orders;
        _options = options;
        _marketDataStreamerFactory = marketDataStreamerFactory;
        _portfolioStreamerFactory = portfolioStreamerFactory;
    }

    // ═══════════════════════════════════════════════════════
    // Feature 1 — Get All Positions
    // ═══════════════════════════════════════════════════════

    /// <summary>Fetch all open and closed positions for the current trading day.</summary>
    public Task<IReadOnlyList<Position>> GetAllPositionsAsync(
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
        OrderType orderType = OrderType.Market,
        Product product = Product.Intraday,
        CancellationToken cancellationToken = default)
        => _positions.ExitAllPositionsAsync(orderType, product, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 4 — Exit Single Position
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Square off a single specified position by instrument token.
    /// </summary>
    /// <param name="instrumentToken">e.g. "NSE_FO|52618"</param>
    public Task<string> ExitPositionAsync(
        string instrumentToken,
        OrderType orderType = OrderType.Market,
        Product product = Product.Intraday,
        CancellationToken cancellationToken = default)
        => _positions.ExitPositionAsync(instrumentToken, orderType, product, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 5 — Cancel All Pending Orders
    // ═══════════════════════════════════════════════════════

    /// <summary>Cancel every open / pending order in the order book.</summary>
    /// <returns>List of cancelled order IDs.</returns>
    public Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(
        CancellationToken cancellationToken = default)
        => _orders.CancelAllPendingOrdersAsync(cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 6 — Place Order
    // ═══════════════════════════════════════════════════════

    /// <summary>Place a standard order (v2 endpoint). Returns a single order ID.</summary>
    public Task<PlaceOrderResult> PlaceOrderAsync(
        PlaceOrderRequest request, CancellationToken cancellationToken = default)
        => _orders.PlaceOrderAsync(request, cancellationToken);

    /// <summary>
    /// Place a standard order (v3 HFT endpoint).
    /// Returns one or more order IDs (multiple when auto-sliced) and API latency in ms.
    /// </summary>
    public Task<PlaceOrderV3Result> PlaceOrderV3Async(
        PlaceOrderRequest request, CancellationToken cancellationToken = default)
        => _orders.PlaceOrderV3Async(request, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 7 — Place Order by Option Price
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Find the strike whose LTP is nearest to the target premium and place a v2 order.
    /// </summary>
    public Task<PlaceOrderResult> PlaceOrderByOptionPriceAsync(
        PlaceOrderByOptionPriceRequest request, CancellationToken cancellationToken = default)
        => _options.PlaceOrderByOptionPriceAsync(request, cancellationToken);

    /// <summary>
    /// Find the strike whose LTP is nearest to the target premium and place a v3 HFT order.
    /// </summary>
    public Task<PlaceOrderV3Result> PlaceOrderByOptionPriceV3Async(
        PlaceOrderByOptionPriceRequest request, CancellationToken cancellationToken = default)
        => _options.PlaceOrderByOptionPriceV3Async(request, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Feature 8 — Place Order by Strike Type
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Resolve the exact strike (ATM / OTM1-5 / ITM1-5) relative to the current spot price
    /// and place a v2 order.
    /// </summary>
    public Task<PlaceOrderResult> PlaceOrderByStrikeAsync(
        PlaceOrderByStrikeRequest request, CancellationToken cancellationToken = default)
        => _options.PlaceOrderByStrikeAsync(request, cancellationToken);

    /// <summary>
    /// Resolve the exact strike (ATM / OTM1-5 / ITM1-5) relative to the current spot price
    /// and place a v3 HFT order.
    /// </summary>
    public Task<PlaceOrderV3Result> PlaceOrderByStrikeV3Async(
        PlaceOrderByStrikeRequest request, CancellationToken cancellationToken = default)
        => _options.PlaceOrderByStrikeV3Async(request, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Additional helpers exposed for convenience
    // ═══════════════════════════════════════════════════════

    /// <summary>Retrieve all orders placed during the current trading day.</summary>
    public Task<IReadOnlyList<Order>> GetAllOrdersAsync(
        CancellationToken cancellationToken = default)
        => _orders.GetAllOrdersAsync(cancellationToken);

    /// <summary>Cancel a single order by ID (v2).</summary>
    public Task<string> CancelOrderAsync(
        string orderId, CancellationToken cancellationToken = default)
        => _orders.CancelOrderAsync(orderId, cancellationToken);

    /// <summary>Cancel a single order by ID (v3 HFT). Returns order ID and latency in ms.</summary>
    public Task<(string OrderId, int Latency)> CancelOrderV3Async(
        string orderId, CancellationToken cancellationToken = default)
        => _orders.CancelOrderV3Async(orderId, cancellationToken);

    /// <summary>Fetch the put/call option chain for an underlying at a given expiry.</summary>
    public Task<IReadOnlyList<OptionChainEntry>> GetOptionChainAsync(
        string underlyingKey, string expiryDate, CancellationToken cancellationToken = default)
        => _options.GetOptionChainAsync(underlyingKey, expiryDate, cancellationToken);

    /// <summary>Fetch option contract metadata (no live prices) for an underlying.</summary>
    public Task<IReadOnlyList<OptionContract>> GetOptionContractsAsync(
        string underlyingKey, string? expiryDate = null, CancellationToken cancellationToken = default)
        => _options.GetOptionContractsAsync(underlyingKey, expiryDate, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // WebSocket streaming — streamer factories
    // ═══════════════════════════════════════════════════════

    /// <summary>
    /// Create a new <see cref="IMarketDataStreamer"/> instance.
    /// Each call returns an independent connection — call <see cref="IMarketDataStreamer.ConnectAsync"/>
    /// on the returned instance to open the WebSocket, then subscribe to instruments.
    /// Dispose the streamer when done.
    /// </summary>
    public IMarketDataStreamer CreateMarketDataStreamer() => _marketDataStreamerFactory();

    /// <summary>
    /// Create a new <see cref="IPortfolioStreamer"/> instance.
    /// Each call returns an independent connection — call <see cref="IPortfolioStreamer.ConnectAsync"/>
    /// on the returned instance to open the WebSocket.
    /// Dispose the streamer when done.
    /// </summary>
    public IPortfolioStreamer CreatePortfolioStreamer() => _portfolioStreamerFactory();
}
