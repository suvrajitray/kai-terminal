using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Services;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Zerodha.Streaming;

/// <summary>
/// Stub implementation of <see cref="IMarketDataStreamer"/> for the Kite WebSocket (KiteTicker).
/// The KiteTicker protocol uses custom binary frames. Full implementation is a future work item.
/// This stub connects but never fires <see cref="FeedReceived"/> events.
/// </summary>
public sealed class KiteTickerStreamer : IMarketDataStreamer
{
    private readonly ILogger<KiteTickerStreamer> _logger;

    public KiteTickerStreamer(ILogger<KiteTickerStreamer> logger) => _logger = logger;

    public bool IsConnected { get; private set; }

#pragma warning disable CS0067  // Events intentionally unused in stub
    public event EventHandler? Connected;
    public event EventHandler<Exception?>? Disconnected;
    public event EventHandler? Reconnecting;
    public event EventHandler? AutoReconnectStopped;
    public event EventHandler<MarketDataMessage>? FeedReceived;
    public event EventHandler<MarketSegmentStatus>? MarketStatusReceived;
#pragma warning restore CS0067

    public Task ConnectAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogWarning(
            "KiteTickerStreamer: KiteTicker streaming is not yet implemented. " +
            "LTP-driven risk evaluation will be unavailable for Zerodha positions.");
        IsConnected = true;
        return Task.CompletedTask;
    }

    public Task DisconnectAsync()
    {
        IsConnected = false;
        return Task.CompletedTask;
    }

    public Task SubscribeAsync(
        IEnumerable<string> instrumentKeys, FeedMode mode = FeedMode.Ltpc, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task UnsubscribeAsync(IEnumerable<string> instrumentKeys, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task ChangeModeAsync(IEnumerable<string> instrumentKeys, FeedMode mode, CancellationToken ct = default)
        => Task.CompletedTask;

    public ValueTask DisposeAsync()
    {
        IsConnected = false;
        return ValueTask.CompletedTask;
    }
}
