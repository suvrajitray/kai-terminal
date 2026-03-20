namespace KAITerminal.Contracts.Streaming;

/// <summary>
/// Broker-agnostic shared market data feed.
/// One implementation (per process) owns the upstream connection and fans out LTP ticks
/// to all in-process subscribers via <see cref="FeedReceived"/>.
/// Cross-process fan-out is handled via Redis pub/sub.
/// </summary>
public interface ISharedMarketDataService
{
    /// <summary>Fires on every LTP batch received from the upstream data source.</summary>
    event EventHandler<LtpUpdate> FeedReceived;

    /// <summary>Adds instruments to the upstream subscription.</summary>
    Task SubscribeAsync(IReadOnlyCollection<string> tokens, FeedMode mode = FeedMode.Ltpc, CancellationToken ct = default);

    /// <summary>Removes instruments from the upstream subscription.</summary>
    Task UnsubscribeAsync(IReadOnlyCollection<string> tokens, CancellationToken ct = default);
}
