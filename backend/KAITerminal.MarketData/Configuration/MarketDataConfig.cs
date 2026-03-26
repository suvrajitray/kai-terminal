namespace KAITerminal.MarketData.Configuration;

public sealed class MarketDataConfig
{
    public const string SectionName = "MarketData";

    /// <summary>Upstox market data API base URL.</summary>
    public string BaseUrl { get; set; } = "https://api.upstox.com";

    /// <summary>Zerodha public instrument CSV base URL.</summary>
    public string ZerodhaDataBaseUrl { get; set; } = "https://api.kite.trade";

    /// <summary>HTTP timeout for market data requests.</summary>
    public TimeSpan HttpTimeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>Automatically reconnect the market data WebSocket after an unexpected disconnect.</summary>
    public bool AutoReconnect { get; set; } = true;

    /// <summary>Base delay (in seconds) between reconnect attempts. Multiplied by the attempt number.</summary>
    public int ReconnectIntervalSeconds { get; set; } = 3;

    /// <summary>Maximum number of consecutive reconnect attempts before giving up.</summary>
    public int MaxReconnectAttempts { get; set; } = 5;
}
