namespace KAITerminal.Api.Extensions;

/// <summary>
/// Provides the IST (Asia/Calcutta) timezone and common conversions.
/// </summary>
public static class IstClock
{
    public static readonly TimeZoneInfo Tz =
        TimeZoneInfo.FindSystemTimeZoneById("Asia/Calcutta");

    public static DateTimeOffset Now =>
        TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Tz);

    public static DateOnly Today =>
        DateOnly.FromDateTime(Now.DateTime);

    public static DateTimeOffset ToIst(DateTimeOffset utc) =>
        TimeZoneInfo.ConvertTime(utc, Tz);
}
