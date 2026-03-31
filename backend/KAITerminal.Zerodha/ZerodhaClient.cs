using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Services;
using KAITerminal.Zerodha.Streaming;


namespace KAITerminal.Zerodha;

/// <summary>
/// High-level facade consolidating all Kite Connect features under a single entry point.
/// Inject this from DI after calling <c>services.AddZerodhaSdk()</c>.
/// </summary>
public sealed class ZerodhaClient
{
    private readonly IBrokerAuthService         _auth;
    private readonly IBrokerPositionService     _positions;
    private readonly IZerodhaOrderService      _orders;
    private readonly IBrokerFundsService        _funds;
    private readonly IBrokerMarginService       _margin;
    private readonly Func<KiteTickerStreamer> _marketDataStreamerFactory;

    public ZerodhaClient(
        IBrokerAuthService        auth,
        IBrokerPositionService    positions,
        IZerodhaOrderService      orders,
        IBrokerFundsService       funds,
        IBrokerMarginService      margin,
        Func<KiteTickerStreamer>   marketDataStreamerFactory)
    {
        _auth                     = auth;
        _positions                = positions;
        _orders                   = orders;
        _funds                    = funds;
        _margin                   = margin;
        _marketDataStreamerFactory = marketDataStreamerFactory;
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    public Task<string> GenerateTokenAsync(
        string clientId, string clientSecret, string authorizationCode, CancellationToken ct = default)
        => _auth.GenerateTokenAsync(clientId, clientSecret, authorizationCode, ct: ct);

    // ── Positions ─────────────────────────────────────────────────────────────

    public Task<IReadOnlyList<BrokerPosition>> GetAllPositionsAsync(CancellationToken ct = default)
        => _positions.GetAllPositionsAsync(ct);

    public Task<decimal> GetTotalMtmAsync(CancellationToken ct = default)
        => _positions.GetTotalMtmAsync(ct);

    public Task ExitAllPositionsAsync(
        IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default)
        => _positions.ExitAllPositionsAsync(exchanges, ct);

    public Task ExitPositionAsync(
        string instrumentToken, string product, CancellationToken ct = default)
        => _positions.ExitPositionAsync(instrumentToken, product, ct);

    public Task ConvertPositionAsync(
        string instrumentToken, string oldProduct, int quantity, CancellationToken ct = default)
        => _positions.ConvertPositionAsync(instrumentToken, oldProduct, quantity, ct);

    // ── Orders ────────────────────────────────────────────────────────────────

    public Task<IReadOnlyList<KAITerminal.Contracts.Domain.BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
        => _orders.GetAllOrdersAsync(ct);

    public Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
        => _orders.PlaceOrderAsync(request, ct);

    // ── Funds ─────────────────────────────────────────────────────────────────

    public Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
        => _funds.GetFundsAsync(ct);

    // ── Margin ────────────────────────────────────────────────────────────────

    public Task<BrokerMarginResult> GetRequiredMarginAsync(
        IEnumerable<BrokerMarginOrderItem> items, CancellationToken ct = default)
        => _margin.GetRequiredMarginAsync(items, ct);

}
