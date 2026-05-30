using FluentAssertions;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Worker.Jobs.AutoEntry;
using Xunit;

namespace KAITerminal.Tests.Worker;

public class AutoEntryEligibilityTests
{
    private static AutoEntryConfig Config(
        string tradingDays      = "Mon,Tue,Wed,Thu,Fri",
        string entryAfter       = "09:30",
        string noEntryAfter     = "11:30",
        bool   onlyExpiryDay    = false,
        bool   excludeExpiryDay = false) => new()
    {
        TradingDays      = tradingDays,
        EntryAfterTime   = entryAfter,
        NoEntryAfterTime = noEntryAfter,
        OnlyExpiryDay    = onlyExpiryDay,
        ExcludeExpiryDay = excludeExpiryDay,
    };

    // 2026-05-30 = Saturday;  2026-06-01 = Monday
    private static readonly DateTimeOffset Saturday    = new(2026, 5, 30, 10, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset MondayInside  = new(2026, 6,  1, 10, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset MondayBefore  = new(2026, 6,  1,  9, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset MondayAfter   = new(2026, 6,  1, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void CheckSchedule_InsideWindow_OnTradingDay_IsEligible()
    {
        AutoEntryEligibility.CheckSchedule(Config(), MondayInside).Should().BeNull();
    }

    [Fact]
    public void CheckSchedule_NonTradingDay_IsSkippedAtDebug()
    {
        var result = AutoEntryEligibility.CheckSchedule(Config(), Saturday);
        result.Should().NotBeNull();
        result!.Severity.Should().Be(EligibilitySeverity.SkippedDebug);
        result.Reason.Should().Contain("Saturday");
    }

    [Fact]
    public void CheckSchedule_OnlyExpiryDay_BypassesDayCheck()
    {
        // Saturday would normally be filtered, but OnlyExpiryDay skips the day check
        var result = AutoEntryEligibility.CheckSchedule(Config(onlyExpiryDay: true), Saturday);
        result.Should().BeNull();
    }

    [Fact]
    public void CheckSchedule_BeforeEntryWindow_IsSkippedAtDebug()
    {
        var result = AutoEntryEligibility.CheckSchedule(Config(), MondayBefore);
        result.Should().NotBeNull();
        result!.Severity.Should().Be(EligibilitySeverity.SkippedDebug);
        result.Reason.Should().Contain("outside");
    }

    [Fact]
    public void CheckSchedule_AfterEntryWindow_IsSkippedAtDebug()
    {
        var result = AutoEntryEligibility.CheckSchedule(Config(), MondayAfter);
        result.Should().NotBeNull();
        result!.Severity.Should().Be(EligibilitySeverity.SkippedDebug);
    }

    [Fact]
    public void CheckSchedule_InvalidTimeFormat_IsWarning()
    {
        var result = AutoEntryEligibility.CheckSchedule(
            Config(entryAfter: "not-a-time"), MondayInside);
        result.Should().NotBeNull();
        result!.Severity.Should().Be(EligibilitySeverity.InvalidConfigWarning);
        result.Reason.Should().Contain("invalid");
    }

    [Fact]
    public void CheckSchedule_TimeAtNoEntryAfter_IsSkipped()
    {
        // nowIst exactly == noEntryAfter should be skipped (>= comparison)
        var atBoundary = new DateTimeOffset(2026, 6, 1, 11, 30, 0, TimeSpan.Zero);
        var result = AutoEntryEligibility.CheckSchedule(Config(), atBoundary);
        result.Should().NotBeNull();
    }

    [Fact]
    public void CheckExpiryDay_OnlyPolicy_NotExpiryToday_IsSkipped()
    {
        var today = new DateOnly(2026, 6, 1);
        var expiry = new DateOnly(2026, 6, 3);
        var result = AutoEntryEligibility.CheckExpiryDay(ExpiryDayPolicy.Only, expiry, today, "NIFTY");
        result.Should().NotBeNull();
        result!.Reason.Should().Contain("OnlyExpiryDay");
    }

    [Fact]
    public void CheckExpiryDay_OnlyPolicy_ExpiryToday_IsEligible()
    {
        var today = new DateOnly(2026, 6, 1);
        AutoEntryEligibility.CheckExpiryDay(ExpiryDayPolicy.Only, today, today, "NIFTY").Should().BeNull();
    }

    [Fact]
    public void CheckExpiryDay_ExcludePolicy_ExpiryToday_IsSkipped()
    {
        var today = new DateOnly(2026, 6, 1);
        var result = AutoEntryEligibility.CheckExpiryDay(ExpiryDayPolicy.Exclude, today, today, "BANKNIFTY");
        result.Should().NotBeNull();
        result!.Reason.Should().Contain("ExcludeExpiryDay").And.Contain("BANKNIFTY");
    }

    [Fact]
    public void CheckExpiryDay_ExcludePolicy_NotExpiryToday_IsEligible()
    {
        var today  = new DateOnly(2026, 6, 1);
        var expiry = new DateOnly(2026, 6, 3);
        AutoEntryEligibility.CheckExpiryDay(ExpiryDayPolicy.Exclude, expiry, today, "NIFTY").Should().BeNull();
    }

    [Fact]
    public void CheckExpiryDay_AnyPolicy_AlwaysEligible()
    {
        var today  = new DateOnly(2026, 6, 1);
        AutoEntryEligibility.CheckExpiryDay(ExpiryDayPolicy.Any, today, today, "X").Should().BeNull();
        AutoEntryEligibility.CheckExpiryDay(ExpiryDayPolicy.Any, today.AddDays(1), today, "X").Should().BeNull();
    }
}
