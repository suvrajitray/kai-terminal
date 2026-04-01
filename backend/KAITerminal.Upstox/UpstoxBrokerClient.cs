using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;

namespace KAITerminal.Upstox;

/// <summary>
/// Adapts <see cref="UpstoxClient"/> to the broker-agnostic <see cref="IBrokerClient"/> interface.
/// Each instance is token-scoped — wraps every call in <c>UpstoxTokenContext.Use(token)</c>.
/// </summary>
public sealed class UpstoxBrokerClient : IBrokerClient
{
    private readonly UpstoxClient _upstox;
    private readonly string _accessToken;

    public UpstoxBrokerClient(UpstoxClient upstox, string accessToken)
    {
        ArgumentNullException.ThrowIfNull(upstox);
        ArgumentException.ThrowIfNullOrEmpty(accessToken);
        _upstox = upstox;
        _accessToken = accessToken;
    }

    public string BrokerType => BrokerNames.Upstox;

    public IDisposable UseToken() => UpstoxTokenContext.Use(_accessToken);

    public async Task<IReadOnlyList<BrokerPosition>> GetAllPositionsAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _upstox.Positions.GetAllPositionsAsync(ct);
    }

    public async Task<decimal> GetTotalMtmAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _upstox.Positions.GetTotalMtmAsync(ct);
    }

    public async Task ExitAllPositionsAsync(IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default)
    {
        using var _ = UseToken();
        await _upstox.Positions.ExitAllPositionsAsync(exchanges, ct);
    }

    public async Task ExitPositionAsync(string instrumentToken, string product, CancellationToken ct = default)
    {
        using var _ = UseToken();
        await _upstox.Positions.ExitPositionAsync(instrumentToken, product, ct);
    }

    public async Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _upstox.Orders.GetAllOrdersAsync(ct);
    }

    public async Task PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        using var _ = UseToken();
        await _upstox.Orders.PlaceOrderAsync(request, ct);
    }

    public async Task<string> CancelOrderAsync(string orderId, CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _upstox.Orders.CancelOrderAsync(orderId, ct);
    }

    public async Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _upstox.Orders.CancelAllPendingOrdersAsync(ct);
    }

    public async Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _upstox.Funds.GetFundsAsync(ct);
    }
}
