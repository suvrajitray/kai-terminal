using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.OrderRouting;
using KAITerminal.Upstox;
using KAITerminal.Zerodha;

namespace KAITerminal.Worker.OrderRouting;

internal sealed class OrderRoutingBrokerClientFactory : IBrokerClientFactory
{
    private readonly UpstoxClient        _upstox;
    private readonly ZerodhaClient?      _zerodha;
    private readonly IOrderAgentRegistry _registry;
    private readonly IOrderRouter        _router;

    public OrderRoutingBrokerClientFactory(
        UpstoxClient        upstox,
        ZerodhaClient?      zerodha,
        IOrderAgentRegistry registry,
        IOrderRouter        router)
    {
        _upstox   = upstox;
        _zerodha  = zerodha;
        _registry = registry;
        _router   = router;
    }

    public IBrokerClient Create(string brokerType, string accessToken, string? apiKey = null, string? username = null)
    {
        IBrokerClient inner = brokerType.Equals(BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase)
            ? new UpstoxBrokerClient(_upstox, accessToken)
            : new ZerodhaBrokerClient(_zerodha!, apiKey!, accessToken);

        if (username is not null && _registry.GetAgent(username) is not null)
            return new OrderRoutingBrokerClient(inner, username, brokerType, accessToken, apiKey, _router);

        return inner;
    }
}
