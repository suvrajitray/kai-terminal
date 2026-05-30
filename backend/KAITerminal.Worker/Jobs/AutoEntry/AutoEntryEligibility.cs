using KAITerminal.Infrastructure.Data;

namespace KAITerminal.Worker.Jobs.AutoEntry;

internal enum EligibilitySeverity { SkippedDebug, InvalidConfigWarning }

internal sealed record EligibilityResult(string Reason, EligibilitySeverity Severity);

/// <summary>
/// Pure scheduling guards. Each method returns null when the config is eligible
/// to proceed, or an <see cref="EligibilityResult"/> indicating why the tick should
/// be skipped and at what log severity.
/// </summary>
internal static class AutoEntryEligibility
{
    public static EligibilityResult? CheckSchedule(AutoEntryConfig config, DateTimeOffset nowIst)
    {
        if (!config.OnlyExpiryDay && !IsTradingDay(config.TradingDays, nowIst.DayOfWeek))
            return new($"day {nowIst.DayOfWeek} not in trading days", EligibilitySeverity.SkippedDebug);

        if (!TimeOnly.TryParse(config.EntryAfterTime,   out var entryAfter)   ||
            !TimeOnly.TryParse(config.NoEntryAfterTime, out var noEntryAfter))
            return new("invalid time config", EligibilitySeverity.InvalidConfigWarning);

        var nowTime = TimeOnly.FromTimeSpan(nowIst.TimeOfDay);
        if (nowTime < entryAfter || nowTime >= noEntryAfter)
            return new($"time {nowTime:HH:mm} outside {entryAfter:HH:mm}–{noEntryAfter:HH:mm}",
                EligibilitySeverity.SkippedDebug);

        return null;
    }

    public static EligibilityResult? CheckExpiryDay(
        ExpiryDayPolicy policy, DateOnly expiryDate, DateOnly today, string instrument)
    {
        if (policy == ExpiryDayPolicy.Only && expiryDate != today)
            return new("OnlyExpiryDay — not expiry today", EligibilitySeverity.SkippedDebug);

        if (policy == ExpiryDayPolicy.Exclude && expiryDate == today)
            return new($"ExcludeExpiryDay — expiry today ({instrument})", EligibilitySeverity.SkippedDebug);

        return null;
    }

    private static bool IsTradingDay(string tradingDays, DayOfWeek dayOfWeek)
    {
        var dayAbbr = dayOfWeek switch
        {
            DayOfWeek.Monday    => "Mon",
            DayOfWeek.Tuesday   => "Tue",
            DayOfWeek.Wednesday => "Wed",
            DayOfWeek.Thursday  => "Thu",
            DayOfWeek.Friday    => "Fri",
            _                   => "",
        };
        if (string.IsNullOrEmpty(dayAbbr)) return false;

        return tradingDays.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Any(d => d.Trim().Equals(dayAbbr, StringComparison.OrdinalIgnoreCase));
    }
}
