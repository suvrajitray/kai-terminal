namespace KAITerminal.Broker.Models;

public class Position
{
  public string Symbol { get; set; } = default!;
  public string OptionType { get; set; } = default!;
  public decimal AveragePrice { get; set; }
  public int Quantity { get; set; }
  public string Product { get; set; } = default!;
  public decimal Ltp { get; set; }
  public bool IsOpen { get; set; }
  public decimal Pnl { get; set; }
  public string? Exchange { get; set; }
  public string InstrumentKey { get; set; } = string.Empty;
}
