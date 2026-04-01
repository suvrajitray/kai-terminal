using KAITerminal.Broker;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Zerodha;

/// <summary>
/// Broker-specific aggregate that bundles all Zerodha service interfaces under a single
/// injectable handle. Endpoints and adapters access operations through the typed properties.
/// </summary>
public sealed class ZerodhaClient
{
    public IBrokerAuthService     Auth      { get; }
    public IBrokerPositionService Positions { get; }
    public IBrokerOrderService    Orders    { get; }
    public IBrokerFundsService    Funds     { get; }
    public IBrokerMarginService   Margin    { get; }

    internal ZerodhaClient(
        ZerodhaAuthService     auth,
        ZerodhaPositionService positions,
        ZerodhaOrderService    orders,
        ZerodhaFundsService    funds,
        ZerodhaMarginService   margin)
    {
        Auth      = auth;
        Positions = positions;
        Orders    = orders;
        Funds     = funds;
        Margin    = margin;
    }
}
