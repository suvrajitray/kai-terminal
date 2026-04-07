using KAITerminal.Broker;

namespace KAITerminal.Zerodha.Services;

/// <summary>
/// Zerodha-specific auth service — extends <see cref="IBrokerAuthService"/> to also
/// return the broker-assigned user ID alongside the access token.
/// </summary>
public interface IZerodhaAuthService : IBrokerAuthService
{
    /// <summary>
    /// Exchanges an authorization code for an access token and returns the Zerodha client ID.
    /// </summary>
    Task<(string AccessToken, string? UserId)> GenerateTokenWithUserIdAsync(
        string clientId,
        string clientSecret,
        string authorizationCode,
        string? redirectUri = null,
        CancellationToken ct = default);
}
