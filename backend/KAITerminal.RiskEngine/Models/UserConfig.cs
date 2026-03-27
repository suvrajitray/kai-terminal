namespace KAITerminal.RiskEngine.Models;

/// <summary>Per-user identity, access token, and risk thresholds. Immutable after construction.</summary>
public sealed record UserConfig
{
    public string UserId { get; init; } = "";
    /// <summary>Broker type — "upstox" | "zerodha". Used by IBrokerClientFactory.</summary>
    public string BrokerType { get; init; } = "upstox";
    public string AccessToken { get; init; } = "";
    /// <summary>API key — required for Zerodha (used in auth header and token exchange).</summary>
    public string? ApiKey { get; init; }

    // Per-user risk thresholds (defaults match frontend defaults)
    public decimal MtmTarget { get; init; } = 25_000m;
    public decimal MtmSl { get; init; } = -25_000m;
    public bool TrailingEnabled { get; init; } = true;
    public decimal TrailingActivateAt { get; init; } = 12_000m;
    public decimal LockProfitAt { get; init; } = 2_000m;
    public decimal WhenProfitIncreasesBy { get; init; } = 99m;
    public decimal IncreaseTrailingBy { get; init; } = 33m;

    // Auto-shift config
    public bool    AutoShiftEnabled      { get; init; } = false;
    public decimal AutoShiftThresholdPct { get; init; } = 30m;
    public int     AutoShiftMaxCount     { get; init; } = 2;
    public int     AutoShiftStrikeGap    { get; init; } = 1;
}
