using System.Net.Http.Json;
using KAITerminal.Contracts.Domain;
using KAITerminal.OrderRouting.Models;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.OrderRouting;

public sealed class HttpOrderAgentClient : IOrderAgentClient
{
    private readonly HttpClient _http;

    public HttpOrderAgentClient(IHttpClientFactory factory)
        => _http = factory.CreateClient("OrderAgent");

    public async Task<PlaceOrderV3Result> PlaceUpstoxOrderAsync(
        string agentUrl, string accessToken,
        PlaceOrderRequest request, CancellationToken ct = default)
    {
        var body = new UpstoxOrderRequest(
            request.InstrumentToken,
            request.Quantity,
            request.TransactionType.ToString(),
            request.OrderType.ToString(),
            request.Product.ToString(),
            request.Validity.ToString(),
            request.Price,
            request.TriggerPrice,
            request.Slice,
            request.Tag);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{agentUrl}/upstox/orders");
        req.Headers.Add("X-Upstox-Access-Token", accessToken);
        req.Content = JsonContent.Create(body);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<PlaceOrderV3Result>(ct)
               ?? throw new InvalidOperationException("Empty response from order agent");
    }

    public async Task<(string OrderId, int Latency)> CancelUpstoxOrderAsync(
        string agentUrl, string accessToken,
        string orderId, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"{agentUrl}/upstox/orders/{orderId}");
        req.Headers.Add("X-Upstox-Access-Token", accessToken);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CancelResult>(ct)
                     ?? throw new InvalidOperationException("Empty cancel response from order agent");
        return (result.OrderId, result.Latency);
    }

    public async Task<IReadOnlyList<string>> CancelAllUpstoxOrdersAsync(
        string agentUrl, string accessToken,
        CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"{agentUrl}/upstox/orders/cancel-all");
        req.Headers.Add("X-Upstox-Access-Token", accessToken);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CancelAllResult>(ct)
                     ?? throw new InvalidOperationException("Empty cancel-all response from order agent");
        return result.OrderIds;
    }

    public async Task<string> PlaceZerodhaOrderAsync(
        string agentUrl, string accessToken, string apiKey,
        BrokerOrderRequest request, CancellationToken ct = default)
    {
        var body = new ZerodhaOrderRequest(
            request.InstrumentToken,
            request.Quantity,
            request.TransactionType,
            request.Product,
            request.OrderType,
            request.Price,
            request.TriggerPrice,
            request.Exchange,
            request.Tag);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{agentUrl}/zerodha/orders");
        req.Headers.Add("X-Zerodha-Api-Key", apiKey);
        req.Headers.Add("X-Zerodha-Access-Token", accessToken);
        req.Content = JsonContent.Create(body);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<PlaceZerodhaResult>(ct)
                     ?? throw new InvalidOperationException("Empty response from order agent");
        return result.OrderId;
    }

    public async Task<string> CancelZerodhaOrderAsync(
        string agentUrl, string accessToken, string apiKey,
        string orderId, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"{agentUrl}/zerodha/orders/{orderId}");
        req.Headers.Add("X-Zerodha-Api-Key", apiKey);
        req.Headers.Add("X-Zerodha-Access-Token", accessToken);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CancelZerodhaResult>(ct)
                     ?? throw new InvalidOperationException("Empty cancel response from order agent");
        return result.OrderId;
    }

    public async Task<IReadOnlyList<string>> CancelAllZerodhaOrdersAsync(
        string agentUrl, string accessToken, string apiKey,
        CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"{agentUrl}/zerodha/orders/cancel-all");
        req.Headers.Add("X-Zerodha-Api-Key", apiKey);
        req.Headers.Add("X-Zerodha-Access-Token", accessToken);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CancelAllResult>(ct)
                     ?? throw new InvalidOperationException("Empty cancel-all response from order agent");
        return result.OrderIds;
    }

    private sealed record CancelResult(string OrderId, int Latency);
    private sealed record CancelZerodhaResult(string OrderId);
    private sealed record CancelAllResult(IReadOnlyList<string> OrderIds);
    private sealed record PlaceZerodhaResult(string OrderId);
}
