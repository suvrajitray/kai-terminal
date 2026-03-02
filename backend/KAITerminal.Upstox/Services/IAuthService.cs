using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

public interface IAuthService
{
    /// <summary>
    /// Exchanges an Upstox authorization code for an access token.
    /// </summary>
    Task<TokenResponse> GenerateTokenAsync(
        string clientId,
        string clientSecret,
        string redirectUri,
        string authorizationCode,
        CancellationToken cancellationToken = default);
}
