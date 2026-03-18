namespace KAITerminal.Contracts.Streaming;

/// <summary>
/// Broker-agnostic portfolio streaming interface (order / position events).
/// Each broker subscribes to the relevant event types internally inside <see cref="ConnectAsync"/>.
/// </summary>
public interface IPortfolioStreamer : IAsyncDisposable
{
    /// <summary>Raised for every portfolio update (order fill, position change, etc.).</summary>
    event EventHandler<PortfolioUpdate>? UpdateReceived;

    /// <summary>Raised at the start of each auto-reconnect attempt.</summary>
    event EventHandler? Reconnecting;

    /// <summary>Opens the streaming connection. Returns after the connection is established.</summary>
    Task ConnectAsync(CancellationToken ct);

    /// <summary>Cancels the receive loop and closes the connection.</summary>
    Task DisconnectAsync();
}
