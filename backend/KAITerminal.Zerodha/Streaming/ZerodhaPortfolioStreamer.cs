using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Services;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Zerodha.Streaming;

/// <summary>
/// Stub implementation of <see cref="IPortfolioStreamer"/> for Zerodha portfolio events.
/// Zerodha does not have a persistent portfolio WebSocket — order/position events arrive
/// via webhooks (postback URL configured in the Kite developer console).
/// Full webhook-based implementation is a future work item.
/// This stub connects but never fires <see cref="UpdateReceived"/> events.
/// </summary>
public sealed class ZerodhaPortfolioStreamer : IPortfolioStreamer
{
    private readonly ILogger<ZerodhaPortfolioStreamer> _logger;

    public ZerodhaPortfolioStreamer(ILogger<ZerodhaPortfolioStreamer> logger) => _logger = logger;

    public bool IsConnected { get; private set; }

#pragma warning disable CS0067  // Events intentionally unused in stub
    public event EventHandler? Connected;
    public event EventHandler<Exception?>? Disconnected;
    public event EventHandler? Reconnecting;
    public event EventHandler? AutoReconnectStopped;
    public event EventHandler<PortfolioStreamUpdate>? UpdateReceived;
#pragma warning restore CS0067

    public Task ConnectAsync(IEnumerable<UpdateType>? updateTypes = null, CancellationToken ct = default)
    {
        _logger.LogWarning(
            "ZerodhaPortfolioStreamer: Portfolio streaming is not yet implemented. " +
            "Portfolio event-driven risk evaluation will be unavailable for Zerodha positions. " +
            "Configure a Kite postback URL to receive order/position updates.");
        IsConnected = true;
        return Task.CompletedTask;
    }

    public Task DisconnectAsync()
    {
        IsConnected = false;
        return Task.CompletedTask;
    }

    public ValueTask DisposeAsync()
    {
        IsConnected = false;
        return ValueTask.CompletedTask;
    }
}
