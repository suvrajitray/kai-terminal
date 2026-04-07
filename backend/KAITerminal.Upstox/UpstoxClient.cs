using KAITerminal.Broker;
using KAITerminal.Upstox.Services;

namespace KAITerminal.Upstox;

/// <summary>
/// Broker-specific aggregate that bundles all Upstox service interfaces under a single
/// injectable handle. Endpoints and adapters access operations through the typed properties.
/// </summary>
public sealed class UpstoxClient
{
    public IUpstoxAuthService     Auth      { get; }
    public IBrokerPositionService Positions { get; }
    public IBrokerOrderService    Orders    { get; }
    public IBrokerMarginService   Margin    { get; }
    public IBrokerFundsService    Funds     { get; }

    /// <summary>Upstox-specific v3 HFT order operations (raw Order type, latency tracking).</summary>
    public IUpstoxHftService Hft { get; }

    internal UpstoxClient(
        UpstoxAuthService     auth,
        UpstoxPositionService positions,
        UpstoxOrderService    orders,
        UpstoxMarginService   margin,
        UpstoxFundsService    funds)
    {
        Auth      = auth;
        Positions = positions;
        Orders    = orders;
        Hft       = orders;   // UpstoxOrderService implements both IBrokerOrderService and IUpstoxHftService
        Margin    = margin;
        Funds     = funds;
    }
}
