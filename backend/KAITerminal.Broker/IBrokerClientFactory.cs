namespace KAITerminal.Broker;

/// <summary>
/// Creates <see cref="IBrokerClient"/> instances scoped to a specific user token.
/// </summary>
public interface IBrokerClientFactory
{
    /// <summary>
    /// Create a broker client for the given broker type and access token.
    /// </summary>
    /// <param name="brokerType">E.g. "upstox", "zerodha".</param>
    /// <param name="accessToken">The user's daily access token.</param>
    /// <param name="apiKey">API key — required for Zerodha (used in auth header + checksum).</param>
    IBrokerClient Create(string brokerType, string accessToken, string? apiKey = null);
}
