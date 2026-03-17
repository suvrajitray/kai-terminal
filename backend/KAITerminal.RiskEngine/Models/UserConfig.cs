namespace KAITerminal.RiskEngine.Models;

/// <summary>Per-user identity, access token, and risk thresholds.</summary>
public sealed class UserConfig
{
    public string UserId { get; set; } = "";
    public string AccessToken { get; set; } = "";

    // Per-user risk thresholds (defaults match frontend defaults)
    public decimal MtmTarget { get; set; } = 25_000m;
    public decimal MtmSl { get; set; } = -25_000m;
    public bool TrailingEnabled { get; set; } = true;
    public decimal TrailingActivateAt { get; set; } = 12_000m;
    public decimal LockProfitAt { get; set; } = 2_000m;
    public decimal WhenProfitIncreasesBy { get; set; } = 99m;
    public decimal IncreaseTrailingBy { get; set; } = 33m;
}
