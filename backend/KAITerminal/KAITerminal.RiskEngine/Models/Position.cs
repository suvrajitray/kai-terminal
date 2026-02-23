namespace KAITerminal.RiskEngine.Models;

public class Position
{
  public string Symbol { get; set; } = default!;
  public string OptionType { get; set; } = default!;
  public decimal AvgPrice { get; set; }
  public int Quantity { get; set; }
  public bool IsOpen { get; set; }
}
