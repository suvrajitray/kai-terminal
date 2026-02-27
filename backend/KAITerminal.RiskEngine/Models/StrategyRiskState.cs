namespace KAITerminal.RiskEngine.Models;

public class StrategyRiskState
{
  public string StrategyId { get; set; } = default!;
  public bool IsSquaredOff { get; set; }

  public bool TrailingActivated { get; set; }
  public decimal CurrentTrailingSl { get; set; }
  public decimal LastTrailTriggerMtm { get; set; }

  public Dictionary<string, int> ReEntries { get; set; } = new();
  public DateTime UpdatedAt { get; set; }
}
