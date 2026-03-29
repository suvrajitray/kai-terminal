namespace KAITerminal.Infrastructure.Data;

public class UserRiskConfig
{
    public int Id { get; set; }
    public string Username { get; set; } = "";       // user email
    /// <summary>Broker this risk config applies to — "upstox" | "zerodha". Unique with Username.</summary>
    public string BrokerType { get; set; } = "upstox";
    public bool Enabled { get; set; } = false;
    public decimal MtmTarget { get; set; } = 25_000m;
    public decimal MtmSl { get; set; } = -25_000m;
    public bool TrailingEnabled { get; set; } = true;
    public decimal TrailingActivateAt { get; set; } = 10_000m;
    public decimal LockProfitAt { get; set; } = 3_000m;
    public decimal IncreaseBy { get; set; } = 100m;  // WhenProfitIncreasesBy
    public decimal TrailBy { get; set; } = 50m;      // IncreaseTrailingBy
    public DateTime UpdatedAt { get; set; }

    // Auto-shift: per-position risk management for sell positions
    public bool    AutoShiftEnabled      { get; set; } = false;
    public decimal AutoShiftThresholdPct { get; set; } = 30m;  // 30 = trigger when LTP rises 30% from entry
    public int     AutoShiftMaxCount     { get; set; } = 2;    // after this many shifts, exit the position
    public int     AutoShiftStrikeGap    { get; set; } = 1;    // strikes to move per auto-shift
}
