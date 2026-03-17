namespace KAITerminal.Infrastructure.Data;

public class UserRiskConfig
{
    public int Id { get; set; }
    public string Username { get; set; } = "";       // user email — unique
    public bool Enabled { get; set; } = false;
    public decimal MtmTarget { get; set; } = 25_000m;
    public decimal MtmSl { get; set; } = -25_000m;
    public bool TrailingEnabled { get; set; } = true;
    public decimal TrailingActivateAt { get; set; } = 12_000m;
    public decimal LockProfitAt { get; set; } = 2_000m;
    public decimal IncreaseBy { get; set; } = 99m;   // WhenProfitIncreasesBy
    public decimal TrailBy { get; set; } = 33m;      // IncreaseTrailingBy
    public DateTime UpdatedAt { get; set; }
}
