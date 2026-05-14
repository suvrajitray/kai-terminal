namespace KAITerminal.RollingStraddle.Configuration;

public sealed class StrategyConfig
{
    public const string SectionName = "Strategy";

    /// <summary>User email — used to look up credentials in the database.</summary>
    public string  Username         { get; set; } = "";

    /// <summary>Broker name — used to look up credentials in the database (e.g. "upstox").</summary>
    public string  BrokerName       { get; set; } = "";

    /// <summary>Upstox instrument key for the index underlying — set by instrument selection at startup.</summary>
    public string  Underlying       { get; set; } = "";

    /// <summary>Option expiry in "yyyy-MM-dd" format.</summary>
    public string  Expiry           { get; set; } = "";

    /// <summary>Number of lots to trade.</summary>
    public int     Lots             { get; set; } = 5;

    /// <summary>Lot size of the underlying — set by instrument selection at startup.</summary>
    public int     LotSize          { get; set; } = 0;

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

    /// <summary>Daily MTM stop-loss per lot in rupees. Effective SL = this × Lots.</summary>
    public decimal DailyMtmStopLossPerLot { get; set; } = 3000m;

    /// <summary>Daily MTM target per lot in rupees. Effective target = this × Lots.</summary>
    public decimal DailyMtmTargetPerLot   { get; set; } = 2000m;

    /// <summary>
    /// Number of strikes OTM for each leg. 0 = straddle (ATM CE + ATM PE).
    /// 1+ = strangle (CE is <value> strikes above ATM, PE is <value> strikes below ATM).
    /// </summary>
    public int     StrikeOffset     { get; set; } = 0;

    /// <summary>Polling interval in milliseconds.</summary>
    public int     CheckIntervalMs  { get; set; } = 5000;

    /// <summary>Minutes to wait after a roll before opening new legs. 0 = immediate re-entry.</summary>
    public int     ReEntryDelayMinutes { get; set; } = 15;
}
