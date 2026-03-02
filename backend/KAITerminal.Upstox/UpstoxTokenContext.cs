namespace KAITerminal.Upstox;

/// <summary>
/// Provides an ambient per-call Upstox access token that overrides the token in
/// <see cref="Configuration.UpstoxConfig"/>. Designed for multi-user scenarios
/// where each API call must authenticate as a different user.
/// </summary>
/// <remarks>
/// Uses <see cref="AsyncLocal{T}"/> so the scope flows correctly through async/await chains.
/// </remarks>
/// <example>
/// <code>
/// // Worker service — set once in config, no need for UpstoxTokenContext.
///
/// // Multi-user terminal — set per call:
/// using (UpstoxTokenContext.Use(currentUser.UpstoxToken))
/// {
///     var positions = await upstoxClient.GetAllPositionsAsync();
///     var orders    = await upstoxClient.GetAllOrdersAsync();
/// }
/// </code>
/// </example>
public static class UpstoxTokenContext
{
    private static readonly AsyncLocal<string?> _token = new();

    /// <summary>
    /// Gets the access token active for the current async call chain,
    /// or <c>null</c> if no per-call token has been set.
    /// </summary>
    public static string? Current => _token.Value;

    /// <summary>
    /// Sets <paramref name="accessToken"/> as the active token for the duration of the
    /// returned scope. Disposing the scope restores the previous token.
    /// </summary>
    /// <param name="accessToken">
    /// The token to activate. Passing <c>null</c> returns a no-op scope that leaves
    /// the current token unchanged.
    /// </param>
    public static IDisposable Use(string? accessToken)
    {
        if (accessToken is null) return NullScope.Instance;
        var previous = _token.Value;
        _token.Value = accessToken;
        return new TokenScope(previous);
    }

    private sealed class TokenScope : IDisposable
    {
        private readonly string? _previous;
        private bool _disposed;

        public TokenScope(string? previous) => _previous = previous;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _token.Value = _previous;
        }
    }

    private sealed class NullScope : IDisposable
    {
        public static readonly NullScope Instance = new();
        public void Dispose() { }
    }
}
