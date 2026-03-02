using KAITerminal.Upstox.Models.WebSocket;

namespace KAITerminal.Upstox.Services;

/// <summary>
/// Streams real-time market data via Upstox Market Data Feed V3 (protobuf over WebSocket).
/// <para>
/// Each instance owns a single WebSocket connection.
/// Use <see cref="KAITerminal.Upstox.UpstoxClient.CreateMarketDataStreamer"/> to obtain a new independent instance.
/// </para>
/// </summary>
public interface IMarketDataStreamer : IAsyncDisposable
{
    /// <summary><c>true</c> when the WebSocket connection is in the Open state.</summary>
    bool IsConnected { get; }

    /// <summary>Raised after the WebSocket is successfully connected (including after each auto-reconnect).</summary>
    event EventHandler? Connected;

    /// <summary>Raised when the connection drops unexpectedly. Argument is the causing exception, or <c>null</c> for server-initiated close.</summary>
    event EventHandler<Exception?>? Disconnected;

    /// <summary>Raised at the start of each auto-reconnect attempt.</summary>
    event EventHandler? Reconnecting;

    /// <summary>Raised when auto-reconnect exhausts all attempts without success.</summary>
    event EventHandler? AutoReconnectStopped;

    /// <summary>Raised whenever a tick message arrives that contains instrument feed data.</summary>
    event EventHandler<MarketDataMessage>? FeedReceived;

    /// <summary>Raised whenever a market-info message arrives (segment open/close status).</summary>
    event EventHandler<MarketSegmentStatus>? MarketStatusReceived;

    /// <summary>
    /// Obtains an authorize URI from the REST API and opens the WebSocket connection.
    /// Returns after the connection is established; the receive loop continues in the background.
    /// </summary>
    Task ConnectAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels the receive loop, waits for it to finish, then sends a WebSocket Close frame.
    /// </summary>
    Task DisconnectAsync();

    /// <summary>Subscribe <paramref name="instrumentKeys"/> at the given <paramref name="mode"/>.</summary>
    Task SubscribeAsync(
        IEnumerable<string> instrumentKeys,
        FeedMode mode = FeedMode.Ltpc,
        CancellationToken ct = default);

    /// <summary>Unsubscribe <paramref name="instrumentKeys"/>.</summary>
    Task UnsubscribeAsync(IEnumerable<string> instrumentKeys, CancellationToken ct = default);

    /// <summary>Switch already-subscribed <paramref name="instrumentKeys"/> to a different <paramref name="mode"/>.</summary>
    Task ChangeModeAsync(IEnumerable<string> instrumentKeys, FeedMode mode, CancellationToken ct = default);
}
