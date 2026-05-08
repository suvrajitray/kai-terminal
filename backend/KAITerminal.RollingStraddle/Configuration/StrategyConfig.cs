namespace KAITerminal.RollingStraddle.Configuration;

public sealed class StrategyConfig
{
    public const string SectionName = "Strategy";

    /// <summary>Upstox instrument key for the index underlying, e.g. "NSE_INDEX|Nifty 50".</summary>
    public string  Underlying       { get; set; } = "NSE_INDEX|Nifty 50";

    /// <summary>Exchange for option legs: NFO for NSE indices, BFO for BSE.</summary>
    public string  Exchange         { get; set; } = "NFO";

    /// <summary>Option expiry in "yyyy-MM-dd" format.</summary>
    public string  Expiry           { get; set; } = "";

    /// <summary>Number of lots to trade.</summary>
    public int     Lots             { get; set; } = 5;

    /// <summary>Lot size of the underlying (NIFTY=65, BANKNIFTY=30, FINNIFTY=60, SENSEX=20, BANKEX=30).</summary>
    public int     LotSize          { get; set; } = 65;

    /// <summary>Time to enter the straddle in "HH:mm" IST format.</summary>
    public string  EntryTime        { get; set; } = "09:35";

    /// <summary>Hard exit time in "HH:mm" IST format.</summary>
    public string  ExitTime         { get; set; } = "15:05";

    /// <summary>Skip entry if India VIX is above this value. Set to 0 to disable the filter.</summary>
    public decimal VixMaxThreshold  { get; set; } = 20m;

    /// <summary>Percentage move from entry spot that triggers a roll (e.g. 0.3 = 0.3%).</summary>
    public decimal RollThresholdPct { get; set; } = 0.3m;

    /// <summary>Maximum number of rolls allowed per day before holding the position regardless.</summary>
    public int     MaxRolls         { get; set; } = 3;

    /// <summary>Daily MTM stop-loss in rupees. Exits all when loss exceeds this amount.</summary>
    public decimal DailyMtmStopLoss { get; set; } = 15000m;

    /// <summary>Daily MTM target in rupees. Exits all when profit reaches this amount.</summary>
    public decimal DailyMtmTarget   { get; set; } = 10000m;

    /// <summary>Polling interval in milliseconds.</summary>
    public int     CheckIntervalMs  { get; set; } = 5000;
}
