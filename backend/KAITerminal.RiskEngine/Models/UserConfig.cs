namespace KAITerminal.RiskEngine.Models;

/// <summary>Per-user identity, access token, and risk thresholds. Immutable after construction.</summary>
public sealed record UserConfig
{
    public string UserId { get; init; } = "";
    public string AccessToken { get; init; } = "";

    // Per-user risk thresholds (defaults match frontend defaults)
    public decimal MtmTarget { get; init; } = 25_000m;
    public decimal MtmSl { get; init; } = -25_000m;
    public bool TrailingEnabled { get; init; } = true;
    public decimal TrailingActivateAt { get; init; } = 12_000m;
    public decimal LockProfitAt { get; init; } = 2_000m;
    public decimal WhenProfitIncreasesBy { get; init; } = 99m;
    public decimal IncreaseTrailingBy { get; init; } = 33m;
}
