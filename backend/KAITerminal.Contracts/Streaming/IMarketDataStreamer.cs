namespace KAITerminal.Contracts.Streaming;

/// <summary>
/// Broker-agnostic market data streaming interface (LTP ticks).
/// Each instance owns a single WebSocket/streaming connection.
/// </summary>
public interface IMarketDataStreamer : IAsyncDisposable
{
    /// <summary>Raised whenever an LTP tick arrives for subscribed instruments.</summary>
    event EventHandler<LtpUpdate>? FeedReceived;

    /// <summary>Raised at the start of each auto-reconnect attempt.</summary>
    event EventHandler? Reconnecting;

    /// <summary>Opens the streaming connection. Returns after the connection is established.</summary>
    Task ConnectAsync(CancellationToken ct);

    /// <summary>Subscribe <paramref name="instrumentTokens"/> at the given <paramref name="mode"/>.</summary>
    Task SubscribeAsync(IReadOnlyCollection<string> instrumentTokens, FeedMode mode);

    /// <summary>Cancels the receive loop and closes the connection.</summary>
    Task DisconnectAsync();
}
