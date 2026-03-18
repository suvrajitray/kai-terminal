using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

public sealed class ZerodhaAuthService : IZerodhaAuthService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaAuthService(ZerodhaHttpClient http) => _http = http;

    public string GetLoginUrl(string apiKey) => _http.GetLoginUrl(apiKey);

    public Task<string> ExchangeTokenAsync(
        string apiKey, string apiSecret, string requestToken, CancellationToken ct = default)
        => _http.ExchangeTokenAsync(apiKey, apiSecret, requestToken, ct);
}
