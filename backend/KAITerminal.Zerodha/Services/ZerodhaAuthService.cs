using KAITerminal.Broker;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaAuthService : IZerodhaAuthService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaAuthService(ZerodhaHttpClient http) => _http = http;

    public Task<string> GenerateTokenAsync(
        string clientId,
        string clientSecret,
        string authorizationCode,
        string? redirectUri = null,
        CancellationToken ct = default)
        => _http.ExchangeTokenAsync(clientId, clientSecret, authorizationCode, ct);

    public Task<(string AccessToken, string? UserId)> GenerateTokenWithUserIdAsync(
        string clientId,
        string clientSecret,
        string authorizationCode,
        string? redirectUri = null,
        CancellationToken ct = default)
        => _http.ExchangeTokenWithUserIdAsync(clientId, clientSecret, authorizationCode, ct);
}
