using KAITerminal.Contracts;

namespace KAITerminal.RiskEngine.Models;

/// <summary>Per-user identity, access token, and risk thresholds. Immutable after construction.</summary>
public sealed record UserConfig
{
    public string UserId { get; init; } = "";
    /// <summary>Broker type — "upstox" | "zerodha". Used by IBrokerClientFactory.</summary>
    public string BrokerType { get; init; } = BrokerNames.Upstox;
    public string AccessToken { get; init; } = "";
    /// <summary>API key — required for Zerodha (used in auth header and token exchange).</summary>
    public string? ApiKey { get; init; }

    // Per-user risk thresholds (defaults match frontend defaults)
    public decimal MtmTarget { get; init; } = 25_000m;
    public decimal MtmSl { get; init; } = -25_000m;
    public bool TrailingEnabled { get; init; } = true;
    public decimal TrailingActivateAt { get; init; } = 10_000m;
    public decimal LockProfitAt { get; init; } = 3_000m;
    public decimal WhenProfitIncreasesBy { get; init; } = 100m;
    public decimal IncreaseTrailingBy { get; init; } = 50m;

    // Auto-shift config
    public bool    AutoShiftEnabled      { get; init; } = false;
    public decimal AutoShiftThresholdPct { get; init; } = 30m;
    public int     AutoShiftMaxCount     { get; init; } = 2;
    public int     AutoShiftStrikeGap    { get; init; } = 1;

    // Auto square-off config
    public bool     AutoSquareOffEnabled { get; init; } = false;
    public TimeSpan AutoSquareOffTime    { get; init; } = new TimeSpan(15, 20, 0);
}
