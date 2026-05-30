using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.OrderRouting;

public interface IOrderRouter
{
    Task<PlaceOrderV3Result> PlaceUpstoxOrderAsync(
        string username, string accessToken,
        PlaceOrderRequest request, CancellationToken ct = default);

    Task<(string OrderId, int Latency)> CancelUpstoxOrderAsync(
        string username, string accessToken,
        string orderId, CancellationToken ct = default);

    Task<IReadOnlyList<string>> CancelAllUpstoxOrdersAsync(
        string username, string accessToken,
        CancellationToken ct = default);

    Task<string> PlaceZerodhaOrderAsync(
        string username, string accessToken, string apiKey,
        BrokerOrderRequest request, CancellationToken ct = default);

    Task<string> CancelZerodhaOrderAsync(
        string username, string accessToken, string apiKey,
        string orderId, CancellationToken ct = default);

    Task<IReadOnlyList<string>> CancelAllZerodhaOrdersAsync(
        string username, string accessToken, string apiKey,
        CancellationToken ct = default);
}
