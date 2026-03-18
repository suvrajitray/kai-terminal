namespace KAITerminal.Contracts.Streaming;

/// <summary>Market data subscription modes exposed by the broker-agnostic streaming interface.</summary>
public enum FeedMode
{
    /// <summary>Last traded price, time, quantity, and close price only.</summary>
    Ltpc,

    /// <summary>Full market data: LTPC + depth, OHLC, and additional fields.</summary>
    Full
}
