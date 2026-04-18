namespace KAITerminal.Infrastructure.Data;

public class AutoEntryConfig
{
    public int    Id         { get; set; }
    public string Username   { get; set; } = "";
    public string BrokerType { get; set; } = "upstox";
    public string Name       { get; set; } = "Strategy";
    public bool   Enabled    { get; set; } = false;
    public string Instrument      { get; set; } = "NIFTY";
    public string OptionType      { get; set; } = "PE";
    public int    Lots            { get; set; } = 1;
    public string EntryAfterTime   { get; set; } = "09:30";
    public string NoEntryAfterTime { get; set; } = "11:30";
    public string TradingDays      { get; set; } = "Mon,Tue,Wed,Thu,Fri";
    public bool   ExcludeExpiryDay { get; set; } = false;
    public int ExpiryOffset { get; set; } = 0;
    public string  StrikeMode  { get; set; } = "ATM";
    public decimal StrikeParam { get; set; } = 0m;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
