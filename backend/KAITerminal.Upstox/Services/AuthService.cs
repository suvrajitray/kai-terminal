using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

internal sealed class AuthService : IAuthService
{
    private readonly UpstoxHttpClient _http;

    public AuthService(UpstoxHttpClient http) => _http = http;

    public Task<TokenResponse> GenerateTokenAsync(
        string clientId,
        string clientSecret,
        string redirectUri,
        string authorizationCode,
        CancellationToken cancellationToken = default)
        => _http.GenerateTokenAsync(clientId, clientSecret, redirectUri, authorizationCode, cancellationToken);
}
