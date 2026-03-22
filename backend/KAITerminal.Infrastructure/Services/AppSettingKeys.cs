namespace KAITerminal.Infrastructure.Services;

/// <summary>Shared constants for AppSettings keys used across Api and Worker.</summary>
public static class AppSettingKeys
{
    /// <summary>Upstox analytics token — read-only, valid for 1 year. Used for market data WebSocket and master data API.</summary>
    public const string UpstoxAnalyticsToken = "upstox_analytics_token";
}
