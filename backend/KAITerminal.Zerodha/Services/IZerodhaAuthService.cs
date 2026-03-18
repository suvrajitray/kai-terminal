namespace KAITerminal.Zerodha.Services;

public interface IZerodhaAuthService
{
    /// <summary>
    /// Returns the Kite Connect login URL to redirect the user to.
    /// After login, Zerodha redirects back with <c>?request_token=</c>.
    /// </summary>
    string GetLoginUrl(string apiKey);

    /// <summary>
    /// Exchanges a <c>request_token</c> (returned by Kite after login) for a daily <c>access_token</c>.
    /// </summary>
    Task<string> ExchangeTokenAsync(
        string apiKey, string apiSecret, string requestToken, CancellationToken ct = default);
}
