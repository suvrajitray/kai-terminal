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
    private readonly IAuthService _auth;
    private readonly IPositionService _positions;
    private readonly IOrderService _orders;
    private readonly IOptionService _options;
    private readonly IMarketQuoteService _quotes;
    private readonly IChartDataService _charts;
    private readonly Func<IMarketDataStreamer> _marketDataStreamerFactory;
    private readonly Func<IPortfolioStreamer> _portfolioStreamerFactory;

    public UpstoxClient(
        IAuthService auth,
        IPositionService positions,
        IOrderService orders,
        IOptionService options,
        IMarketQuoteService quotes,
        IChartDataService charts,
        Func<IMarketDataStreamer> marketDataStreamerFactory,
        Func<IPortfolioStreamer> portfolioStreamerFactory)
    {
        _auth = auth;
        _positions = positions;
        _orders = orders;
        _options = options;
        _quotes = quotes;
        _charts = charts;
        _marketDataStreamerFactory = marketDataStreamerFactory;
        _portfolioStreamerFactory = portfolioStreamerFactory;
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
    /// <param name="redirectUri">Redirect URI registered in the Upstox developer console.</param>
    /// <param name="authorizationCode">The <c>code</c> received in the OAuth callback.</param>
    public Task<TokenResponse> GenerateTokenAsync(
        string clientId,
        string clientSecret,
        string redirectUri,
        string authorizationCode,
        CancellationToken cancellationToken = default)
        => _auth.GenerateTokenAsync(clientId, clientSecret, redirectUri, authorizationCode, cancellationToken);

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
    /// Resolve the option chain entry whose LTP best matches <paramref name="targetPremium"/>
    /// and return it without placing any order.
    /// </summary>
    public Task<OptionChainEntry> GetOrderByOptionPriceAsync(
        string underlyingKey, string expiryDate, OptionType optionType,
        decimal targetPremium, PriceSearchMode priceSearchMode = PriceSearchMode.Nearest,
        CancellationToken cancellationToken = default)
        => _options.GetOrderByOptionPriceAsync(underlyingKey, expiryDate, optionType, targetPremium, priceSearchMode, cancellationToken);

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
    /// Resolve the option chain entry for the given strike type (ATM / OTM1-5 / ITM1-5)
    /// and return it without placing any order.
    /// </summary>
    public Task<OptionChainEntry> GetOrderByStrikeAsync(
        string underlyingKey, string expiryDate, OptionType optionType, StrikeType strikeType,
        CancellationToken cancellationToken = default)
        => _options.GetOrderByStrikeAsync(underlyingKey, expiryDate, optionType, strikeType, cancellationToken);

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

    /// <summary>Cancel a single order by ID (v3 HFT). Returns order ID and latency in ms.</summary>
    public Task<(string OrderId, int Latency)> CancelOrderV3Async(
        string orderId, CancellationToken cancellationToken = default)
        => _orders.CancelOrderV3Async(orderId, cancellationToken);

    /// <summary>Fetch full market quotes (LTP + OHLC) for a list of instruments.</summary>
    public Task<IReadOnlyDictionary<string, MarketQuote>> GetMarketQuotesAsync(
        IEnumerable<string> instrumentKeys, CancellationToken cancellationToken = default)
        => _quotes.GetMarketQuotesAsync(instrumentKeys, cancellationToken);

    /// <summary>Fetch the put/call option chain for an underlying at a given expiry.</summary>
    public Task<IReadOnlyList<OptionChainEntry>> GetOptionChainAsync(
        string underlyingKey, string expiryDate, CancellationToken cancellationToken = default)
        => _options.GetOptionChainAsync(underlyingKey, expiryDate, cancellationToken);

    /// <summary>Fetch option contract metadata (no live prices) for an underlying.</summary>
    public Task<IReadOnlyList<OptionContract>> GetOptionContractsAsync(
        string underlyingKey, string? expiryDate = null, CancellationToken cancellationToken = default)
        => _options.GetOptionContractsAsync(underlyingKey, expiryDate, cancellationToken);

    // ═══════════════════════════════════════════════════════
    // Charts — historical candles + instrument search
    // ═══════════════════════════════════════════════════════

    /// <summary>Fetch historical OHLCV candles for an instrument.</summary>
    public Task<IReadOnlyList<CandleData>> GetHistoricalCandlesAsync(
        string instrumentKey, CandleInterval interval, DateOnly from, DateOnly to,
        CancellationToken cancellationToken = default)
        => _charts.GetHistoricalCandlesAsync(instrumentKey, interval, from, to, cancellationToken);

    /// <summary>Fetch today's intraday OHLCV candles for an instrument.</summary>
    public Task<IReadOnlyList<CandleData>> GetIntradayCandlesAsync(
        string instrumentKey, CandleInterval interval,
        CancellationToken cancellationToken = default)
        => _charts.GetIntradayCandlesAsync(instrumentKey, interval, cancellationToken);

    /// <summary>Search for instruments by name or symbol.</summary>
    public Task<IReadOnlyList<InstrumentSearchResult>> SearchInstrumentsAsync(
        string query, CancellationToken cancellationToken = default)
        => _charts.SearchInstrumentsAsync(query, cancellationToken);

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
