using KAITerminal.Broker;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Upstox.Services;
using KAITerminal.Zerodha.Services;
using KAITerminal.Zerodha.Streaming;

namespace KAITerminal.Zerodha;

/// <summary>
/// High-level facade consolidating all Kite Connect features under a single entry point.
/// Inject this from DI after calling <c>services.AddZerodhaSdk()</c>.
/// </summary>
public sealed class ZerodhaClient
{
    private readonly IZerodhaAuthService       _auth;
    private readonly IZerodhaPositionService   _positions;
    private readonly IZerodhaOrderService      _orders;
    private readonly IZerodhaFundsService      _funds;
    private readonly IZerodhaInstrumentService _instruments;
    private readonly Func<KiteTickerStreamer>         _marketDataStreamerFactory;
    private readonly Func<ZerodhaPortfolioStreamer>   _portfolioStreamerFactory;

    public ZerodhaClient(
        IZerodhaAuthService       auth,
        IZerodhaPositionService   positions,
        IZerodhaOrderService      orders,
        IZerodhaFundsService      funds,
        IZerodhaInstrumentService instruments,
        Func<KiteTickerStreamer>         marketDataStreamerFactory,
        Func<ZerodhaPortfolioStreamer>   portfolioStreamerFactory)
    {
        _auth                     = auth;
        _positions                = positions;
        _orders                   = orders;
        _funds                    = funds;
        _instruments              = instruments;
        _marketDataStreamerFactory = marketDataStreamerFactory;
        _portfolioStreamerFactory  = portfolioStreamerFactory;
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    public string GetLoginUrl(string apiKey) => _auth.GetLoginUrl(apiKey);

    public Task<string> ExchangeTokenAsync(
        string apiKey, string apiSecret, string requestToken, CancellationToken ct = default)
        => _auth.ExchangeTokenAsync(apiKey, apiSecret, requestToken, ct);

    // ── Positions ─────────────────────────────────────────────────────────────

    public Task<IReadOnlyList<Position>> GetAllPositionsAsync(CancellationToken ct = default)
        => _positions.GetAllPositionsAsync(ct);

    public Task<decimal> GetTotalMtmAsync(CancellationToken ct = default)
        => _positions.GetTotalMtmAsync(ct);

    public Task ExitAllPositionsAsync(
        IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default)
        => _positions.ExitAllPositionsAsync(exchanges, ct);

    public Task ExitPositionAsync(
        string instrumentToken, string product, CancellationToken ct = default)
        => _positions.ExitPositionAsync(instrumentToken, product, ct);

    // ── Orders ────────────────────────────────────────────────────────────────

    public Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
        => _orders.PlaceOrderAsync(request, ct);

    // ── Funds ─────────────────────────────────────────────────────────────────

    public Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
        => _funds.GetFundsAsync(ct);

    // ── Instruments ───────────────────────────────────────────────────────────

    public Task<IReadOnlyList<OptionContract>> GetOptionContractsAsync(
        string underlyingSymbol, CancellationToken ct = default)
        => _instruments.GetCurrentYearContractsAsync(underlyingSymbol, ct);

    // ── Streaming ─────────────────────────────────────────────────────────────

    public IMarketDataStreamer CreateMarketDataStreamer() => _marketDataStreamerFactory();
    public IPortfolioStreamer  CreatePortfolioStreamer()  => _portfolioStreamerFactory();
}
