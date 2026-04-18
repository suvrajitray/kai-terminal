namespace KAITerminal.Infrastructure.Data;

public class AutoEntryLog
{
    public int    Id           { get; set; }
    public int    StrategyId   { get; set; }
    public string Instrument   { get; set; } = "";
    public string TradeDateIst { get; set; } = "";
    public DateTime EnteredAtUtc { get; set; }
}
