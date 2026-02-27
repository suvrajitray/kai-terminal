namespace KAITerminal.RiskEngine.Models;

public class RiskConfig
{
  public decimal OverallStopLoss { get; set; }
  public decimal OverallTarget { get; set; }

  public TrailingConfig Trailing { get; set; } = new();
  public StrikeSLConfig StrikeSL { get; set; } = new();
}

public class TrailingConfig
{
  public bool Enabled { get; set; } = true;
  public decimal ActivateAt { get; set; } = 5000;
  public decimal LockProfitAt { get; set; } = 2000;
  public decimal ProfitStep { get; set; } = 1000;
  public decimal TslIncrement { get; set; } = 500;
}

public class StrikeSLConfig
{
  public decimal CePercent { get; set; } = 20;
  public decimal PePercent { get; set; } = 30;
  public int MaxReEntry { get; set; } = 2;
  public int StrikeGap { get; set; } = 100;
}
