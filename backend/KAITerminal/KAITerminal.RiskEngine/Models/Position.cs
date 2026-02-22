namespace RiskEngine.Models;

public class Position
{
  public string Symbol { get; set; } = default!;
  public string OptionType { get; set; } = default!; // CE / PE
  public decimal AvgPrice { get; set; }
  public decimal Ltp { get; set; }
  public int Quantity { get; set; }
  public bool IsOpen { get; set; }
  public int ReEntryCount { get; set; }
}
