namespace KAITerminal.Upstox.Models.Enums;

/// <summary>
/// Relative strike selection for index/options trading.
/// ATM = closest strike to spot price.
/// OTMn = n strikes out-of-the-money from ATM (CE: higher strikes, PE: lower strikes).
/// ITMn = n strikes in-the-money from ATM (CE: lower strikes, PE: higher strikes).
/// </summary>
public enum StrikeType
{
    ATM,
    OTM1,
    OTM2,
    OTM3,
    OTM4,
    OTM5,
    ITM1,
    ITM2,
    ITM3,
    ITM4,
    ITM5
}
