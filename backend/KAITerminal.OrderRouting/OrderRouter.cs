using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Zerodha;

namespace KAITerminal.OrderRouting;

public sealed class OrderRouter : IOrderRouter
{
    private readonly IOrderAgentRegistry _registry;
    private readonly IOrderAgentClient   _agentClient;
    private readonly UpstoxClient        _upstox;
    private readonly ZerodhaClient?      _zerodha;

    public OrderRouter(
        IOrderAgentRegistry registry,
        IOrderAgentClient   agentClient,
        UpstoxClient        upstox,
        ZerodhaClient?      zerodha = null)
    {
        _registry    = registry;
        _agentClient = agentClient;
        _upstox      = upstox;
        _zerodha     = zerodha;
    }

    public async Task<PlaceOrderV3Result> PlaceUpstoxOrderAsync(
        string username, string accessToken,
        PlaceOrderRequest request, CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.PlaceUpstoxOrderAsync(agent.Url, accessToken, request, ct);

        using var _ = UpstoxTokenContext.Use(accessToken);
        return await _upstox.Hft.PlaceOrderV3Async(request, ct);
    }

    public async Task<(string OrderId, int Latency)> CancelUpstoxOrderAsync(
        string username, string accessToken,
        string orderId, CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.CancelUpstoxOrderAsync(agent.Url, accessToken, orderId, ct);

        using var _ = UpstoxTokenContext.Use(accessToken);
        return await _upstox.Hft.CancelOrderV3Async(orderId, ct);
    }

    public async Task<IReadOnlyList<string>> CancelAllUpstoxOrdersAsync(
        string username, string accessToken,
        CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.CancelAllUpstoxOrdersAsync(agent.Url, accessToken, ct);

        using var _ = UpstoxTokenContext.Use(accessToken);
        return await _upstox.Orders.CancelAllPendingOrdersAsync(ct);
    }

    public async Task<string> PlaceZerodhaOrderAsync(
        string username, string accessToken, string apiKey,
        BrokerOrderRequest request, CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.PlaceZerodhaOrderAsync(agent.Url, accessToken, apiKey, request, ct);

        using var _ = ZerodhaTokenContext.Use(apiKey, accessToken);
        return await _zerodha!.Orders.PlaceOrderAsync(request, ct);
    }

    public async Task<string> CancelZerodhaOrderAsync(
        string username, string accessToken, string apiKey,
        string orderId, CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.CancelZerodhaOrderAsync(agent.Url, accessToken, apiKey, orderId, ct);

        using var _ = ZerodhaTokenContext.Use(apiKey, accessToken);
        return await _zerodha!.Orders.CancelOrderAsync(orderId, ct);
    }

    public async Task<IReadOnlyList<string>> CancelAllZerodhaOrdersAsync(
        string username, string accessToken, string apiKey,
        CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.CancelAllZerodhaOrdersAsync(agent.Url, accessToken, apiKey, ct);

        using var _ = ZerodhaTokenContext.Use(apiKey, accessToken);
        return await _zerodha!.Orders.CancelAllPendingOrdersAsync(ct);
    }
}
