using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Upstox.Services;

namespace KAITerminal.Broker;

/// <summary>
/// Broker-agnostic interface for interacting with any supported broker.
/// Implementations: <c>UpstoxBrokerClient</c>, <c>ZerodhaBrokerClient</c>.
/// </summary>
public interface IBrokerClient
{
    /// <summary>Identifies the broker — e.g. "upstox", "zerodha".</summary>
    string BrokerType { get; }

    /// <summary>
    /// Sets the appropriate ambient token context for this broker.
    /// Use in a <c>using</c> block around streamer <c>ConnectAsync</c> calls that need
    /// the token for WebSocket authorisation.
    /// </summary>
    IDisposable UseToken();

    // ── Positions ────────────────────────────────────────────────────────────

    /// <summary>Fetch all open and closed positions for the current trading day.</summary>
    Task<IReadOnlyList<Position>> GetAllPositionsAsync(CancellationToken ct = default);

    /// <summary>Calculate total MTM across all positions.</summary>
    Task<decimal> GetTotalMtmAsync(CancellationToken ct = default);

    /// <summary>Exit all open positions, optionally filtered by exchange.</summary>
    Task ExitAllPositionsAsync(IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default);

    /// <summary>Exit a single position by instrument token.</summary>
    Task ExitPositionAsync(string instrumentToken, string product, CancellationToken ct = default);

    // ── Orders ───────────────────────────────────────────────────────────────

    /// <summary>Place an order using broker-agnostic request parameters.</summary>
    Task PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default);

    // ── Funds ────────────────────────────────────────────────────────────────

    /// <summary>Fetch available and used margin for the equity/F&amp;O segment.</summary>
    Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default);

    // ── Streaming ────────────────────────────────────────────────────────────

    /// <summary>Create a new market data streaming connection (LTP ticks).</summary>
    IMarketDataStreamer CreateMarketDataStreamer();

    /// <summary>Create a new portfolio streaming connection (order/position events).</summary>
    IPortfolioStreamer CreatePortfolioStreamer();
}
