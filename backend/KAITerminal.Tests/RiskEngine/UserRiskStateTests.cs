using FluentAssertions;
using KAITerminal.RiskEngine.Models;
using Xunit;

namespace KAITerminal.Tests.RiskEngine;

public class UserRiskStateTests
{
    // ── Re-entry counts ───────────────────────────────────────────────────────

    [Fact]
    public void IncrementReentryCount_StartsAtOne()
    {
        var state = new UserRiskState();
        state.IncrementReentryCount("NIFTY25JAN2323000CE").Should().Be(1);
    }

    [Fact]
    public void IncrementReentryCount_IncrementsOnSubsequentCalls()
    {
        var state = new UserRiskState();
        state.IncrementReentryCount("NIFTY25JAN2323000CE");
        state.IncrementReentryCount("NIFTY25JAN2323000CE").Should().Be(2);
    }

    [Fact]
    public void IncrementReentryCount_CountersAreIndependentPerSymbol()
    {
        var state = new UserRiskState();
        state.IncrementReentryCount("SYMBOL_A");
        state.IncrementReentryCount("SYMBOL_A");
        state.IncrementReentryCount("SYMBOL_B").Should().Be(1);
    }

    // ── Auto-shift counts ─────────────────────────────────────────────────────

    [Fact]
    public void IncrementAutoShiftCount_StartsAtOne()
    {
        var state = new UserRiskState();
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_PE_22000").Should().Be(1);
    }

    [Fact]
    public void IncrementAutoShiftCount_IncrementsOnSubsequentCalls()
    {
        var state = new UserRiskState();
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_PE_22000");
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_PE_22000").Should().Be(2);
    }

    [Fact]
    public void IncrementAutoShiftCount_CountersAreIndependentPerChainKey()
    {
        var state = new UserRiskState();
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_PE_22000");
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_CE_22000").Should().Be(1);
    }

    // ── Shift origin map ──────────────────────────────────────────────────────

    [Fact]
    public void MapShiftOrigin_RoundTrips()
    {
        var state = new UserRiskState();
        state.MapShiftOrigin("NSE_FO|123456", "NIFTY_2026-04-17_PE_22000");
        state.ShiftOriginMap["NSE_FO|123456"].Should().Be("NIFTY_2026-04-17_PE_22000");
    }

    [Fact]
    public void MapShiftOrigin_OverwritesExistingEntry()
    {
        var state = new UserRiskState();
        state.MapShiftOrigin("NSE_FO|123456", "NIFTY_2026-04-17_PE_22000");
        state.MapShiftOrigin("NSE_FO|123456", "NIFTY_2026-04-17_PE_21900");
        state.ShiftOriginMap["NSE_FO|123456"].Should().Be("NIFTY_2026-04-17_PE_21900");
    }

    // ── Exited chain keys ─────────────────────────────────────────────────────

    [Fact]
    public void MarkChainExited_AddsKeyToSet()
    {
        var state = new UserRiskState();
        state.MarkChainExited("NIFTY_2026-04-17_PE_22000");
        state.ExitedChainKeys.Should().Contain("NIFTY_2026-04-17_PE_22000");
    }

    [Fact]
    public void MarkChainExited_IsIdempotent()
    {
        var state = new UserRiskState();
        state.MarkChainExited("NIFTY_2026-04-17_PE_22000");
        var act = () => state.MarkChainExited("NIFTY_2026-04-17_PE_22000");
        act.Should().NotThrow();
        state.ExitedChainKeys.Should().HaveCount(1);
    }
}
