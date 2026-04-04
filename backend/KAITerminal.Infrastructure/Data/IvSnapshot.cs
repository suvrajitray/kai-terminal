namespace KAITerminal.Infrastructure.Data;

public class IvSnapshot
{
    public int      Id         { get; set; }
    public DateOnly Date       { get; set; }
    public string   Underlying { get; set; } = "";
    public string   Expiry     { get; set; } = "";
    public decimal  AtmStrike  { get; set; }
    public decimal  AtmIv      { get; set; }
    public decimal  AtmCallLtp { get; set; }
    public decimal  AtmPutLtp  { get; set; }
    public decimal  SpotPrice  { get; set; }
    public DateTime CreatedAt  { get; set; }
}
