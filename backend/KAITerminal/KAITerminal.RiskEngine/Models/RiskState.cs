namespace RiskEngine.Models;

public class RiskState
{
  public bool IsSquaredOff { get; set; }
  public decimal CurrentTrailingSl { get; set; }
  public bool TrailingActivated { get; set; }
  public decimal LastTrailTriggerMtm { get; set; }
}
