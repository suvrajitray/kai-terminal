using Xunit;
using FluentAssertions;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Services;

namespace KAITerminal.Tests.RiskEngine;

public class TrailingStopCalculatorTests
{
    // ── Disabled ──────────────────────────────────────────────────────────────

    [Fact]
    public void ReturnsNull_WhenTrailingDisabled()
    {
        var config = new UserConfig { TrailingEnabled = false };
        TrailingStopCalculator.Evaluate(50_000m, config, new UserRiskState().ToSnapshot())
            .Should().BeNull();
    }

    // ── Not yet active ────────────────────────────────────────────────────────

    [Fact]
    public void ReturnsNull_WhenNotActiveAndBelowThreshold()
    {
        var config = new UserConfig { TrailingEnabled = true, TrailingActivateAt = 10_000m };
        TrailingStopCalculator.Evaluate(9_999m, config, new UserRiskState().ToSnapshot())
            .Should().BeNull();
    }

    [Fact]
    public void ReturnsActivation_WhenMtmExactlyAtThreshold()
    {
        var config = new UserConfig
        {
            TrailingEnabled    = true,
            TrailingActivateAt = 10_000m,
            LockProfitAt       = 3_000m,
        };

        var result = TrailingStopCalculator.Evaluate(10_000m, config, new UserRiskState().ToSnapshot());

        result.Should().NotBeNull();
        result!.IsActivation.Should().BeTrue();
        result.NewStop.Should().Be(3_000m);
        result.NewLastTrigger.Should().Be(10_000m);
    }

    [Fact]
    public void ReturnsActivation_WhenMtmAboveThreshold()
    {
        var config = new UserConfig
        {
            TrailingEnabled    = true,
            TrailingActivateAt = 10_000m,
            LockProfitAt       = 3_000m,
        };

        var result = TrailingStopCalculator.Evaluate(12_000m, config, new UserRiskState().ToSnapshot());

        result.Should().NotBeNull();
        result!.IsActivation.Should().BeTrue();
    }

    // ── Already active ────────────────────────────────────────────────────────

    [Fact]
    public void ReturnsNull_WhenActiveButGainLessThanOneStep()
    {
        var config = new UserConfig
        {
            TrailingEnabled      = true,
            WhenProfitIncreasesBy = 1_000m,
        };
        var state = new UserRiskState
        {
            TrailingActive      = true,
            TrailingStop        = 3_000m,
            TrailingLastTrigger = 10_000m,
        };

        // gain = 10_999 - 10_000 = 999, which is < 1 step (1_000)
        TrailingStopCalculator.Evaluate(10_999m, config, state.ToSnapshot())
            .Should().BeNull();
    }

    [Fact]
    public void RaisesFloor_WhenGainEqualsExactlyOneStep()
    {
        var config = new UserConfig
        {
            TrailingEnabled       = true,
            WhenProfitIncreasesBy = 1_000m,
            IncreaseTrailingBy    = 500m,
        };
        var state = new UserRiskState
        {
            TrailingActive      = true,
            TrailingStop        = 3_000m,
            TrailingLastTrigger = 10_000m,
        };

        // gain = 11_000 - 10_000 = 1_000 = exactly 1 step
        var result = TrailingStopCalculator.Evaluate(11_000m, config, state.ToSnapshot());

        result.Should().NotBeNull();
        result!.IsActivation.Should().BeFalse();
        result.NewStop.Should().Be(3_500m);           // 3_000 + 1 × 500
        result.NewLastTrigger.Should().Be(11_000m);   // 10_000 + 1 × 1_000
    }

    [Fact]
    public void RaisesFloor_ByIntegerStepsOnly_WhenGainIs2Point5Steps()
    {
        var config = new UserConfig
        {
            TrailingEnabled       = true,
            WhenProfitIncreasesBy = 1_000m,
            IncreaseTrailingBy    = 500m,
        };
        var state = new UserRiskState
        {
            TrailingActive      = true,
            TrailingStop        = 3_000m,
            TrailingLastTrigger = 10_000m,
        };

        // gain = 12_500 - 10_000 = 2_500 = 2.5 steps → only 2 steps used
        var result = TrailingStopCalculator.Evaluate(12_500m, config, state.ToSnapshot());

        result.Should().NotBeNull();
        result!.NewStop.Should().Be(4_000m);          // 3_000 + 2 × 500
        result.NewLastTrigger.Should().Be(12_000m);   // 10_000 + 2 × 1_000
    }
}
