using KAITerminal.Broker;

namespace KAITerminal.Upstox.Services;

/// <summary>
/// Upstox-specific auth service — extends <see cref="IBrokerAuthService"/> to also
/// return the broker-assigned user ID alongside the access token.
/// </summary>
public interface IUpstoxAuthService : IBrokerAuthService
{
    /// <summary>
    /// Exchanges an authorization code for an access token and returns the Upstox user ID.
    /// </summary>
    Task<(string AccessToken, string UserId)> GenerateTokenWithUserIdAsync(
        string clientId,
        string clientSecret,
        string authorizationCode,
        string? redirectUri = null,
        CancellationToken ct = default);
}
