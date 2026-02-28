using System.Net.Http.Headers;
using System.Net.Http.Json;
using KAITerminal.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.Broker.Upstox;

public class UpstoxHttpClient
{
    private readonly HttpClient _http;
    private readonly UpstoxSettings _settings;
    private readonly ILogger<UpstoxHttpClient> _logger;

    public UpstoxHttpClient(
        HttpClient http,
        IOptions<UpstoxSettings> settings,
        ILogger<UpstoxHttpClient> logger)
    {
        _http = http;
        _settings = settings.Value;
        _logger = logger;
        _http.BaseAddress = new Uri(_settings.BaseUrl);
    }

    private void SetBearer(AccessToken token) =>
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Value);

    public async Task<HttpResponseMessage> PostFormAsync(
        string url,
        Dictionary<string, string> form,
        CancellationToken ct = default)
    {
        _logger.LogDebug("POST form to {Url}", url);
        return await _http.PostAsync(url, new FormUrlEncodedContent(form), ct);
    }

    public async Task<string> GetStringAsync(
        AccessToken token,
        string path,
        CancellationToken ct = default)
    {
        SetBearer(token);
        _logger.LogDebug("GET {Path}", path);
        return await _http.GetStringAsync(path, ct);
    }

    public async Task<HttpResponseMessage> PostJsonAsync(
        AccessToken token,
        string url,
        object body,
        CancellationToken ct = default)
    {
        SetBearer(token);
        _logger.LogDebug("POST JSON to {Url}", url);
        return await _http.PostAsJsonAsync(url, body, ct);
    }
}
