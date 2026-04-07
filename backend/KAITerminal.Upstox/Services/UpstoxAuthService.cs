using KAITerminal.Broker;
using KAITerminal.Upstox.Http;

namespace KAITerminal.Upstox.Services;

internal sealed class UpstoxAuthService : IUpstoxAuthService
{
    private readonly UpstoxHttpClient _http;

    public UpstoxAuthService(UpstoxHttpClient http) => _http = http;

    public async Task<string> GenerateTokenAsync(
        string clientId,
        string clientSecret,
        string authorizationCode,
        string? redirectUri = null,
        CancellationToken ct = default)
    {
        var token = await _http.GenerateTokenAsync(clientId, clientSecret, redirectUri ?? "", authorizationCode, ct);
        return token.AccessToken;
    }

    public async Task<(string AccessToken, string UserId)> GenerateTokenWithUserIdAsync(
        string clientId,
        string clientSecret,
        string authorizationCode,
        string? redirectUri = null,
        CancellationToken ct = default)
    {
        var token = await _http.GenerateTokenAsync(clientId, clientSecret, redirectUri ?? "", authorizationCode, ct);
        return (token.AccessToken, token.UserId ?? "");
    }
}
