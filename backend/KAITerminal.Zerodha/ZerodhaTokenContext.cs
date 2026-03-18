namespace KAITerminal.Zerodha;

/// <summary>
/// Ambient per-call Zerodha credentials (api_key + access_token).
/// Zerodha requires both in every request header — unlike Upstox which only needs the token.
/// </summary>
public static class ZerodhaTokenContext
{
    private static readonly AsyncLocal<(string ApiKey, string AccessToken)?> _credentials = new();

    /// <summary>Gets the active credentials for the current async call chain.</summary>
    public static (string ApiKey, string AccessToken)? Current => _credentials.Value;

    /// <summary>
    /// Activates the given credentials for the duration of the returned scope.
    /// Disposing the scope restores the previous credentials.
    /// </summary>
    public static IDisposable Use(string apiKey, string accessToken)
    {
        if (string.IsNullOrEmpty(apiKey) || string.IsNullOrEmpty(accessToken))
            return NullScope.Instance;

        var previous = _credentials.Value;
        _credentials.Value = (apiKey, accessToken);
        return new CredentialsScope(previous);
    }

    private sealed class CredentialsScope : IDisposable
    {
        private readonly (string, string)? _previous;
        private bool _disposed;

        public CredentialsScope((string, string)? previous) => _previous = previous;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _credentials.Value = _previous;
        }
    }

    private sealed class NullScope : IDisposable
    {
        public static readonly NullScope Instance = new();
        public void Dispose() { }
    }
}
