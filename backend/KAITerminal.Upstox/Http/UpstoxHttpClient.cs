using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using KAITerminal.Upstox.Exceptions;
using KAITerminal.Upstox.Models;

namespace KAITerminal.Upstox.Http;

/// <summary>
/// Internal HTTP client that wraps the Upstox REST API.
/// Uses three named HttpClients: "UpstoxApi" (read), "UpstoxHft" (order writes),
/// and "UpstoxAuth" (login flow).
///
/// Partial-class split by domain — see <c>UpstoxHttpClient.Orders.cs</c>,
/// <c>UpstoxHttpClient.Portfolio.cs</c>, <c>UpstoxHttpClient.Auth.cs</c>,
/// <c>UpstoxHttpClient.OptionChain.cs</c>, <c>UpstoxHttpClient.Feed.cs</c>.
/// </summary>
internal sealed partial class UpstoxHttpClient
{
    private readonly IHttpClientFactory _factory;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    public UpstoxHttpClient(IHttpClientFactory factory)
    {
        _factory = factory;
    }

    // ── Generic transport helpers ────────────────────────────────────────────

    private async Task<IReadOnlyList<T>> GetListAsync<T>(
        string clientName, string path, CancellationToken ct)
    {
        var client = _factory.CreateClient(clientName);
        var response = await client.GetAsync(path, ct);
        var data = await HandleResponseAsync<List<T>>(response, ct);
        return data.AsReadOnly();
    }

    private async Task<T> GetObjectAsync<T>(string clientName, string path, CancellationToken ct)
    {
        var client = _factory.CreateClient(clientName);
        var response = await client.GetAsync(path, ct);
        return await HandleResponseAsync<T>(response, ct);
    }

    private async Task<T> PostAsync<T>(
        string clientName, string path, object body, CancellationToken ct)
    {
        var client = _factory.CreateClient(clientName);
        var response = await client.PostAsJsonAsync(path, body, JsonOptions, ct);
        return await HandleResponseAsync<T>(response, ct);
    }

    private async Task<(T Data, int Latency)> PostWithMetaAsync<T>(
        string clientName, string path, object body, CancellationToken ct)
    {
        var client = _factory.CreateClient(clientName);
        var response = await client.PostAsJsonAsync(path, body, JsonOptions, ct);
        return await HandleResponseWithMetaAsync<T>(response, ct);
    }

    private async Task<T> HandleResponseAsync<T>(HttpResponseMessage response, CancellationToken ct)
    {
        var (data, _) = await HandleResponseWithMetaAsync<T>(response, ct);
        return data;
    }

    private async Task<(T Data, int Latency)> HandleResponseWithMetaAsync<T>(
        HttpResponseMessage response, CancellationToken ct)
    {
        var json = await response.Content.ReadAsStringAsync(ct);

        UpstoxEnvelope<T>? envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<UpstoxEnvelope<T>>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new UpstoxException(
                $"Failed to deserialize Upstox response: {ex.Message}",
                (int)response.StatusCode);
        }

        if (envelope?.Status != "success" || envelope.Data is null)
        {
            var errors = envelope?.Errors?
                .Select(e => new UpstoxApiError { ErrorCode = e.ErrorCode, Message = e.Message })
                .ToList()
                .AsReadOnly();

            var msg = errors?.FirstOrDefault()?.Message
                      ?? $"Upstox API error (HTTP {(int)response.StatusCode})";
            var code = errors?.FirstOrDefault()?.ErrorCode;

            throw new UpstoxException(msg, (int)response.StatusCode, code, errors);
        }

        var latency = envelope.Metadata?.Latency ?? 0;
        return (envelope.Data, latency);
    }

    // ── Internal envelope DTOs ───────────────────────────────────────────────

    private sealed class UpstoxEnvelope<T>
    {
        [JsonPropertyName("status")] public string? Status { get; init; }
        [JsonPropertyName("data")] public T? Data { get; init; }
        [JsonPropertyName("errors")] public List<ApiErrorDto>? Errors { get; init; }
        [JsonPropertyName("metadata")] public MetadataDto? Metadata { get; init; }
    }

    private sealed class ApiErrorDto
    {
        [JsonPropertyName("errorCode")] public string? ErrorCode { get; init; }
        [JsonPropertyName("message")] public string? Message { get; init; }
    }

    private sealed class MetadataDto
    {
        [JsonPropertyName("latency")] public int Latency { get; init; }
    }
}
