namespace KAITerminal.Upstox.Models.WebSocket;

// ─── Message type ─────────────────────────────────────────────────────────────

public enum MessageType
{
    InitialFeed,
    LiveFeed,
    MarketInfo
}

// ─── Top-level tick event ─────────────────────────────────────────────────────

public sealed record MarketDataMessage
{
    public MessageType Type { get; init; }

    /// <summary>Server-side timestamp in milliseconds since Unix epoch.</summary>
    public long TimestampMs { get; init; }

    public DateTimeOffset Timestamp { get; init; }

    /// <summary>Per-instrument feed data, keyed by instrument key (e.g. "NSE_INDEX|Nifty 50").</summary>
    public IReadOnlyDictionary<string, InstrumentFeed> Instruments { get; init; }
        = new Dictionary<string, InstrumentFeed>();
}

// ─── Per-instrument result ────────────────────────────────────────────────────

public sealed record InstrumentFeed
{
    public FeedMode Mode { get; init; }

    /// <summary>Populated when <see cref="Mode"/> is <see cref="FeedMode.Ltpc"/>.</summary>
    public LtpcData? Ltpc { get; init; }

    /// <summary>Populated when <see cref="Mode"/> is <see cref="FeedMode.Full"/> or <see cref="FeedMode.FullD30"/>.</summary>
    public FullFeedData? Full { get; init; }

    /// <summary>Populated when <see cref="Mode"/> is <see cref="FeedMode.OptionGreeks"/>.</summary>
    public OptionGreeksFeedData? OptionGreeks { get; init; }
}

// ─── LTPC ─────────────────────────────────────────────────────────────────────

public sealed record LtpcData
{
    public decimal Ltp { get; init; }

    /// <summary>Last traded time.</summary>
    public DateTimeOffset Ltt { get; init; }

    /// <summary>Last traded quantity.</summary>
    public long Ltq { get; init; }

    /// <summary>Previous close price.</summary>
    public decimal Cp { get; init; }
}

// ─── Full feed ────────────────────────────────────────────────────────────────

public sealed record FullFeedData
{
    public LtpcData Ltpc { get; init; } = new();
    public long Vtt { get; init; }
    public decimal Atp { get; init; }
    public decimal Oi { get; init; }
    public decimal Iv { get; init; }
    public Depth? Depth { get; init; }
    public IReadOnlyList<OhlcBar> Ohlc { get; init; } = [];
    public Greeks? Greeks { get; init; }

    /// <summary><c>true</c> when this feed came from an index instrument (no depth/greeks/OI).</summary>
    public bool IsIndex { get; init; }
}

// ─── OptionGreeks feed ────────────────────────────────────────────────────────

public sealed record OptionGreeksFeedData
{
    public LtpcData Ltpc { get; init; } = new();
    public long Vtt { get; init; }
    public decimal Atp { get; init; }
    public decimal Oi { get; init; }
    public decimal Iv { get; init; }
    public Depth? Depth { get; init; }
    public Greeks? Greeks { get; init; }
}

// ─── Supporting records ───────────────────────────────────────────────────────

/// <summary>5-level (or 30-level) bid/ask depth.</summary>
public sealed record Depth(IReadOnlyList<BidAsk> Bids, IReadOnlyList<BidAsk> Asks);

public sealed record BidAsk
{
    public decimal Price { get; init; }
    public long Quantity { get; init; }
    public int Orders { get; init; }
}

public sealed record OhlcBar
{
    public string Interval { get; init; } = "";
    public decimal Open { get; init; }
    public decimal High { get; init; }
    public decimal Low { get; init; }
    public decimal Close { get; init; }
    public long Volume { get; init; }
    public DateTimeOffset Timestamp { get; init; }
}

public sealed record Greeks
{
    public decimal Delta { get; init; }
    public decimal Gamma { get; init; }
    public decimal Theta { get; init; }
    public decimal Vega { get; init; }
    public decimal Iv { get; init; }
}

// ─── Market segment status ────────────────────────────────────────────────────

public sealed record MarketSegmentStatus
{
    /// <summary>Segment name → status string (e.g. "NSE_FO" → "Normal").</summary>
    public IReadOnlyDictionary<string, string> Segments { get; init; }
        = new Dictionary<string, string>();
}
