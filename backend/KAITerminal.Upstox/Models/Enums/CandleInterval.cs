namespace KAITerminal.Upstox.Models.Enums;

/// <summary>
/// Intervals supported by the Upstox v2 historical candle API.
/// Note: 5min, 15min, and 1hr are NOT supported by Upstox.
/// </summary>
public enum CandleInterval
{
    OneMinute,
    ThirtyMinute,
    OneDay,
    OneWeek,
    OneMonth
}
