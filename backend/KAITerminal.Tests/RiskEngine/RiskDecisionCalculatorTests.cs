using Xunit;
using FluentAssertions;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Services;

namespace KAITerminal.Tests.RiskEngine;

public class RiskDecisionCalculatorTests
{
    // Baseline config: trailing off, auto-square-off off.
    // All thresholds explicit so tests aren't affected by UserConfig default values.
    private static UserConfig BaseConfig() => new()
    {
        MtmSl                = -10_000m,
        MtmTarget            = 20_000m,
        TrailingEnabled      = false,
        AutoSquareOffEnabled = false,
        TrailingActivateAt   = 10_000m,
        LockProfitAt         = 3_000m,
        WhenProfitIncreasesBy = 1_000m,
        IncreaseTrailingBy   = 500m,
        AutoSquareOffTime    = new TimeSpan(15, 20, 0),
    };

    // ── MTM Stop-Loss ─────────────────────────────────────────────────────────

    [Fact]
    public void ExitMtmSl_WhenMtmAtSlBoundary()
    {
        var config   = BaseConfig();
        var decision = RiskDecisionCalculator.Evaluate(config.MtmSl, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitMtmSl);
    }

    [Fact]
    public void ExitMtmSl_WhenMtmBelowSl()
    {
        var config   = BaseConfig();
        var decision = RiskDecisionCalculator.Evaluate(config.MtmSl - 1m, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitMtmSl);
    }

    // ── Profit Target ─────────────────────────────────────────────────────────

    [Fact]
    public void ExitTarget_WhenMtmAtTargetBoundary()
    {
        var config   = BaseConfig();
        var decision = RiskDecisionCalculator.Evaluate(config.MtmTarget, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitTarget);
    }

    [Fact]
    public void ExitTarget_WhenMtmAboveTarget()
    {
        var config   = BaseConfig();
        var decision = RiskDecisionCalculator.Evaluate(config.MtmTarget + 1m, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitTarget);
    }

    // ── Auto Square-Off ───────────────────────────────────────────────────────

    [Fact]
    public void ExitAutoSquareOff_WhenEnabledAndTimeReached()
    {
        var config = BaseConfig() with { AutoSquareOffEnabled = true };
        // nowIst exactly equals configured time
        var decision = RiskDecisionCalculator.Evaluate(0m, config, new UserRiskState(), config.AutoSquareOffTime);
        decision.Kind.Should().Be(RiskDecisionKind.ExitAutoSquareOff);
    }

    [Fact]
    public void ExitAutoSquareOff_WhenEnabledAndTimePassed()
    {
        var config = BaseConfig() with { AutoSquareOffEnabled = true };
        var decision = RiskDecisionCalculator.Evaluate(0m, config, new UserRiskState(), config.AutoSquareOffTime + TimeSpan.FromMinutes(1));
        decision.Kind.Should().Be(RiskDecisionKind.ExitAutoSquareOff);
    }

    [Fact]
    public void None_WhenAutoSquareOffDisabled()
    {
        var config = BaseConfig() with { AutoSquareOffEnabled = false };
        var decision = RiskDecisionCalculator.Evaluate(0m, config, new UserRiskState(), new TimeSpan(23, 59, 59));
        decision.Kind.Should().Be(RiskDecisionKind.None);
    }

    // ── Trailing Stop Loss ────────────────────────────────────────────────────

    [Fact]
    public void None_WhenTrailingInactiveAndBelowThreshold()
    {
        var config = BaseConfig() with { TrailingEnabled = true };
        var decision = RiskDecisionCalculator.Evaluate(5_000m, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.None);
        decision.TrailingUpdate.Should().BeNull();
    }

    [Fact]
    public void TrailingActivation_ReturnsNoneWithActivationUpdate()
    {
        var config = BaseConfig() with { TrailingEnabled = true };
        // MTM exactly at activation threshold
        var decision = RiskDecisionCalculator.Evaluate(config.TrailingActivateAt, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.None);
        decision.TrailingUpdate.Should().NotBeNull();
        decision.TrailingUpdate!.IsActivation.Should().BeTrue();
        decision.TrailingUpdate.NewStop.Should().Be(config.LockProfitAt);
    }

    [Fact]
    public void ExitTrailingSl_WhenActiveAndMtmHitsExistingFloor()
    {
        var config = BaseConfig() with { TrailingEnabled = true };
        var state  = new UserRiskState { TrailingActive = true, TrailingStop = 5_000m };
        // MTM exactly at existing floor
        var decision = RiskDecisionCalculator.Evaluate(5_000m, config, state, TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitTrailingSl);
    }

    [Fact]
    public void ExitTrailingSl_WhenFloorRaisedThisTickAndImmediatelyHit()
    {
        // Floor raise is huge relative to current MTM, so the raised floor instantly exceeds MTM.
        // State: active, LastTrigger=0, current floor=8_000.
        // Config: raise by 5_000 every 100 gain.
        // MTM = 100 → gain = 100 = 1 step → new floor = 8_000 + 5_000 = 13_000.
        // mtm 100 ≤ 13_000 → ExitTrailingSl.
        var config = BaseConfig() with
        {
            TrailingEnabled       = true,
            WhenProfitIncreasesBy = 100m,
            IncreaseTrailingBy    = 5_000m,
        };
        var state = new UserRiskState
        {
            TrailingActive      = true,
            TrailingStop        = 8_000m,
            TrailingLastTrigger = 0m,
        };

        var decision = RiskDecisionCalculator.Evaluate(100m, config, state, TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitTrailingSl);
    }

    // ── Priority order ────────────────────────────────────────────────────────

    [Fact]
    public void SlCheckedBeforeTarget_WhenBothSatisfied()
    {
        // Degenerate config: target (−2) is below SL (−1), so MTM = −1 satisfies both.
        // Correct order: SL fires first.
        var config = BaseConfig() with { MtmSl = -1m, MtmTarget = -2m };
        var decision = RiskDecisionCalculator.Evaluate(-1m, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitMtmSl);
    }
}
