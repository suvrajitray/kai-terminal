using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.OrderRouting;

namespace KAITerminal.Worker.OrderRouting;

internal sealed class OrderRoutingBrokerClient : IBrokerClient
{
    private readonly IBrokerClient _inner;
    private readonly string        _username;
    private readonly string        _brokerType;
    private readonly string        _accessToken;
    private readonly string?       _apiKey;
    private readonly IOrderRouter  _router;

    public OrderRoutingBrokerClient(
        IBrokerClient inner,
        string        username,
        string        brokerType,
        string        accessToken,
        string?       apiKey,
        IOrderRouter  router)
    {
        _inner       = inner;
        _username    = username;
        _brokerType  = brokerType;
        _accessToken = accessToken;
        _apiKey      = apiKey;
        _router      = router;
    }

    public string BrokerType => _inner.BrokerType;
    public IDisposable UseToken() => _inner.UseToken();

    public async Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        if (!IsUpstox()) return await _router.PlaceZerodhaOrderAsync(_username, _accessToken, _apiKey!, request, ct);

        var upstoxRequest = UpstoxOrderRequestAdapter.From(request);
        var result = await _router.PlaceUpstoxOrderAsync(_username, _accessToken, upstoxRequest, ct);
        return string.Join(",", result.OrderIds);
    }

    private bool IsUpstox() =>
        _brokerType.Equals(BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase);

    public async Task<string> CancelOrderAsync(string orderId, CancellationToken ct = default)
    {
        if (!IsUpstox())
            return await _router.CancelZerodhaOrderAsync(_username, _accessToken, _apiKey!, orderId, ct);

        var (id, _) = await _router.CancelUpstoxOrderAsync(_username, _accessToken, orderId, ct);
        return id;
    }

    public Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken ct = default) =>
        IsUpstox()
            ? _router.CancelAllUpstoxOrdersAsync(_username, _accessToken, ct)
            : _router.CancelAllZerodhaOrdersAsync(_username, _accessToken, _apiKey!, ct);

    public Task<IReadOnlyList<BrokerPosition>> GetAllPositionsAsync(CancellationToken ct = default)
        => _inner.GetAllPositionsAsync(ct);

    public Task<decimal> GetTotalMtmAsync(CancellationToken ct = default)
        => _inner.GetTotalMtmAsync(ct);

    public async Task ExitPositionAsync(string instrumentToken, string product, CancellationToken ct = default)
    {
        var token = instrumentToken.Contains('|')
            ? instrumentToken.Split('|', 2)[1]
            : instrumentToken;

        var positions = await _inner.GetAllPositionsAsync(ct);
        var pos = positions.FirstOrDefault(p =>
            p.InstrumentToken.Equals(token, StringComparison.OrdinalIgnoreCase) ||
            p.InstrumentToken.Equals(instrumentToken, StringComparison.OrdinalIgnoreCase));

        if (pos is null || pos.Quantity == 0) return;

        await PlaceOrderAsync(new BrokerOrderRequest(
            pos.InstrumentToken,
            Math.Abs(pos.Quantity),
            PositionHelper.CloseTransactionType(pos.Quantity),
            pos.Product,
            "MARKET",
            null, null,
            pos.Exchange,
            "EXIT"), ct);
    }

    public async Task ExitAllPositionsAsync(IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default)
    {
        var positions = await _inner.GetAllPositionsAsync(ct);
        var plan      = ExitPlanner.Plan(positions, exchanges);
        if (plan.IsEmpty) return;

        await Task.WhenAll(plan.Shorts.Select(p => PlaceOrderAsync(BuildExitOrder(p, "BUY"),  ct)));
        await Task.WhenAll(plan.Longs.Select (p => PlaceOrderAsync(BuildExitOrder(p, "SELL"), ct)));
    }

    private static BrokerOrderRequest BuildExitOrder(BrokerPosition p, string transactionType) =>
        new(p.InstrumentToken, Math.Abs(p.Quantity), transactionType, p.Product,
            "MARKET", null, null, p.Exchange, "EXIT");

    public Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
        => _inner.GetAllOrdersAsync(ct);

    public Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
        => _inner.GetFundsAsync(ct);
}
