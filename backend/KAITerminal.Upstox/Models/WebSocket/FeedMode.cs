namespace KAITerminal.Upstox.Models.WebSocket;

public enum FeedMode
{
    /// <summary>Last traded price, time, quantity, and close price only.</summary>
    Ltpc,

    /// <summary>Full market data: LTPC, depth, OHLC, ATP, VTT, OI, IV, and option greeks.</summary>
    Full,

    /// <summary>First-level depth with option greeks (suitable for options instruments).</summary>
    OptionGreeks,

    /// <summary>Full data with 30-level depth.</summary>
    FullD30
}
