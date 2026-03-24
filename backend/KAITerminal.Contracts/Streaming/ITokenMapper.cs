namespace KAITerminal.Contracts.Streaming;

/// <summary>
/// Translates broker-native instrument tokens to/from Upstox market-data feed tokens.
/// Required because the shared market data feed (Upstox WebSocket) only understands
/// Upstox-format tokens (e.g. "NSE_FO|37590"), while Zerodha positions use numeric
/// instrument tokens (e.g. "226623237").
/// </summary>
public interface ITokenMapper
{
    /// <summary>
    /// Ensures the token mapping data is loaded for the given broker. Must be awaited
    /// before calling <see cref="ToFeedTokens"/> or <see cref="ToNativeToken"/>.
    /// Safe to call multiple times — loads at most once per day.
    /// Upstox tokens are already in feed format so implementations may skip loading for Upstox.
    /// </summary>
    Task EnsureReadyAsync(string brokerType, CancellationToken ct);

    /// <summary>
    /// Maps native position instrument tokens to Upstox feed tokens for market-data subscription.
    /// For Upstox, returns the same tokens. For Zerodha, maps numeric → NSE_FO/BSE_FO format.
    /// Tokens with no mapping found are silently dropped.
    /// </summary>
    IReadOnlyList<string> ToFeedTokens(string brokerType, IReadOnlyList<string> nativeTokens);

    /// <summary>
    /// Maps an Upstox feed token back to the native position instrument token.
    /// For Upstox, returns the feed token unchanged. For Zerodha, maps back to numeric token.
    /// Returns the feed token itself if no mapping is found.
    /// </summary>
    string ToNativeToken(string brokerType, string feedToken);
}
