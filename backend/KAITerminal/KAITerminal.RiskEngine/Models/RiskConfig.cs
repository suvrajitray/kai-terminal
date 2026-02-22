namespace RiskEngine.Models;

public class RiskConfig
{
    public decimal OverallStopLoss { get; set; }
    public decimal OverallTarget { get; set; }

    public TrailingConfig Trailing { get; set; } = new();
    public StrikeSLConfig StrikeSL { get; set; } = new();
}

public class TrailingConfig
{
    public bool Enabled { get; set; }
    public decimal ActivateAt { get; set; }
    public decimal LockProfitAt { get; set; }
    public decimal ProfitStep { get; set; }
    public decimal TslIncrement { get; set; }
}

public class StrikeSLConfig
{
    public decimal CePercent { get; set; } = 20;
    public decimal PePercent { get; set; } = 30;
    public int MaxReEntry { get; set; } = 2;
    public int StrikeGap { get; set; } = 100;
}
