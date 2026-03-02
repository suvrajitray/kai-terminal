using KAITerminal.Upstox.Models.WebSocket;

namespace KAITerminal.Upstox.Services;

/// <summary>
/// Streams real-time portfolio updates (orders, positions, holdings) via Upstox Portfolio Stream Feed V2
/// (plain JSON text frames over WebSocket).
/// <para>
/// Use <see cref="KAITerminal.Upstox.UpstoxClient.CreatePortfolioStreamer"/> to obtain a new independent instance.
/// </para>
/// </summary>
public interface IPortfolioStreamer : IAsyncDisposable
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

    /// <summary>Raised for every portfolio update message received.</summary>
    event EventHandler<PortfolioStreamUpdate>? UpdateReceived;

    /// <summary>
    /// Obtains an authorize URI (optionally filtered by <paramref name="updateTypes"/>), then opens the WebSocket.
    /// Returns after the connection is established; the receive loop continues in the background.
    /// </summary>
    Task ConnectAsync(IEnumerable<UpdateType>? updateTypes = null, CancellationToken ct = default);

    /// <summary>Cancels the receive loop and sends a WebSocket Close frame.</summary>
    Task DisconnectAsync();
}
