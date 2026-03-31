namespace KAITerminal.Broker;

/// <summary>
/// Broker-agnostic interface for exchanging an authorization code for an access token.
/// </summary>
public interface IBrokerAuthService
{
    /// <summary>
    /// Exchanges an authorization code for an access token.
    /// </summary>
    /// <param name="clientId">API key / client ID for the broker.</param>
    /// <param name="clientSecret">API secret / client secret for the broker.</param>
    /// <param name="authorizationCode">The authorization code / request token returned by the broker OAuth flow.</param>
    /// <param name="redirectUri">Redirect URI registered with the broker. Optional — only required by brokers that use redirect-based OAuth (e.g. Upstox).</param>
    Task<string> GenerateTokenAsync(
        string clientId,
        string clientSecret,
        string authorizationCode,
        string? redirectUri = null,
        CancellationToken ct = default);
}
