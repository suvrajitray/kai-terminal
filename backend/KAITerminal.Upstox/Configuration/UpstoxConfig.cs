namespace KAITerminal.Upstox.Configuration;

public sealed class UpstoxConfig
{
    public const string SectionName = "Upstox";

    /// <summary>
    /// Daily OAuth2 access token obtained after login.
    /// Optional when using <see cref="KAITerminal.Upstox.UpstoxTokenContext"/> to supply tokens per call.
    /// </summary>
    public string? AccessToken { get; set; }

    /// <summary>Standard read API base URL.</summary>
    public string ApiBaseUrl { get; set; } = "https://api.upstox.com";

    /// <summary>HFT order-write API base URL (v2 and v3 order placement/modification/cancellation).</summary>
    public string HftBaseUrl { get; set; } = "https://api-hft.upstox.com";

    /// <summary>HTTP request timeout.</summary>
    public TimeSpan HttpTimeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>Automatically reconnect WebSocket streams after an unexpected disconnect.</summary>
    public bool AutoReconnect { get; set; } = true;

    /// <summary>Base delay (in seconds) between reconnect attempts. Multiplied by the attempt number.</summary>
    public int ReconnectIntervalSeconds { get; set; } = 3;

    /// <summary>Maximum number of consecutive reconnect attempts before giving up.</summary>
    public int MaxReconnectAttempts { get; set; } = 5;
}
