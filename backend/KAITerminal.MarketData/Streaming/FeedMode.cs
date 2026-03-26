namespace KAITerminal.MarketData.Streaming;

/// <summary>
/// Upstox-specific feed modes for the market data WebSocket.
/// More granular than <see cref="KAITerminal.Contracts.Streaming.FeedMode"/>.
/// </summary>
internal enum FeedMode
{
    Ltpc,
    Full,
    OptionGreeks,
    FullD30
}
