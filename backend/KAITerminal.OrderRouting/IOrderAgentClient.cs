using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.OrderRouting;

public interface IOrderAgentClient
{
    Task<PlaceOrderV3Result> PlaceUpstoxOrderAsync(
        string agentUrl, string accessToken,
        PlaceOrderRequest request, CancellationToken ct = default);

    Task<(string OrderId, int Latency)> CancelUpstoxOrderAsync(
        string agentUrl, string accessToken,
        string orderId, CancellationToken ct = default);

    Task<IReadOnlyList<string>> CancelAllUpstoxOrdersAsync(
        string agentUrl, string accessToken,
        CancellationToken ct = default);

    Task<string> PlaceZerodhaOrderAsync(
        string agentUrl, string accessToken, string apiKey,
        BrokerOrderRequest request, CancellationToken ct = default);

    Task<string> CancelZerodhaOrderAsync(
        string agentUrl, string accessToken, string apiKey,
        string orderId, CancellationToken ct = default);

    Task<IReadOnlyList<string>> CancelAllZerodhaOrdersAsync(
        string agentUrl, string accessToken, string apiKey,
        CancellationToken ct = default);
}
