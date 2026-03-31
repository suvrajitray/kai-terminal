using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;

namespace KAITerminal.Zerodha;

/// <summary>
/// Adapts <see cref="ZerodhaClient"/> to the broker-agnostic <see cref="IBrokerClient"/> interface.
/// Each instance is token-scoped — wraps every call in <c>ZerodhaTokenContext.Use(apiKey, token)</c>.
/// </summary>
public sealed class ZerodhaBrokerClient : IBrokerClient
{
    private readonly ZerodhaClient _zerodha;
    private readonly string _apiKey;
    private readonly string _accessToken;

    public ZerodhaBrokerClient(ZerodhaClient zerodha, string apiKey, string accessToken)
    {
        ArgumentNullException.ThrowIfNull(zerodha);
        ArgumentException.ThrowIfNullOrEmpty(apiKey);
        ArgumentException.ThrowIfNullOrEmpty(accessToken);
        _zerodha     = zerodha;
        _apiKey      = apiKey;
        _accessToken = accessToken;
    }

    public string BrokerType => "zerodha";

    public IDisposable UseToken() => ZerodhaTokenContext.Use(_apiKey, _accessToken);

    public async Task<IReadOnlyList<BrokerPosition>> GetAllPositionsAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _zerodha.GetAllPositionsAsync(ct);
    }

    public async Task<decimal> GetTotalMtmAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _zerodha.GetTotalMtmAsync(ct);
    }

    public async Task ExitAllPositionsAsync(IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default)
    {
        using var _ = UseToken();
        await _zerodha.ExitAllPositionsAsync(exchanges, ct);
    }

    public async Task ExitPositionAsync(string instrumentToken, string product, CancellationToken ct = default)
    {
        using var _ = UseToken();
        await _zerodha.ExitPositionAsync(instrumentToken, product, ct);
    }

    public async Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _zerodha.GetAllOrdersAsync(ct);
    }

    public async Task PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        using var _ = UseToken();
        await _zerodha.PlaceOrderAsync(request, ct);
    }

    public async Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _zerodha.GetFundsAsync(ct);
    }

}
