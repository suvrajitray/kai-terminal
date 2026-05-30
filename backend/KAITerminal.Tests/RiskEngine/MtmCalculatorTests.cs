using FluentAssertions;
using KAITerminal.Contracts.Domain;
using KAITerminal.RiskEngine.Services;
using Xunit;

namespace KAITerminal.Tests.RiskEngine;

public class MtmCalculatorTests
{
    private static BrokerPosition Position(
        string  token   = "NIFTY",
        int     qty     = -50,
        decimal ltp     = 100m,
        decimal pnl     = 500m,
        string  product = "I") => new()
    {
        InstrumentToken = token,
        Quantity        = qty,
        Ltp             = ltp,
        Pnl             = pnl,
        Product         = product,
    };

    [Fact]
    public void Compute_EmptyPositions_ReturnsZero()
    {
        var mtm = MtmCalculator.Compute([], _ => null);
        mtm.Should().Be(0m);
    }

    [Fact]
    public void Compute_ClosedPosition_AlwaysUsesBrokerPnl_IgnoringLtp()
    {
        var p = Position(qty: 0, ltp: 100m, pnl: 1_234m);
        var mtm = MtmCalculator.Compute([p], _ => 999m);
        mtm.Should().Be(1_234m);
    }

    [Fact]
    public void Compute_OpenPosition_WithoutLiveLtp_UsesBrokerPnl()
    {
        var p = Position(qty: -50, ltp: 100m, pnl: 500m);
        var mtm = MtmCalculator.Compute([p], _ => null);
        mtm.Should().Be(500m);
    }

    [Fact]
    public void Compute_OpenShort_WithLiveLtpAbove_DecreasesMtm()
    {
        // Short 50 lots at avg-price implied by Ltp=100. Live LTP rises to 110:
        // pnl(500) + qty(-50) × (110 - 100) = 500 + (-500) = 0
        var p = Position(qty: -50, ltp: 100m, pnl: 500m);
        var mtm = MtmCalculator.Compute([p], _ => 110m);
        mtm.Should().Be(0m);
    }

    [Fact]
    public void Compute_OpenLong_WithLiveLtpAbove_IncreasesMtm()
    {
        // Long 50 lots, live LTP up 5: pnl(500) + 50 × (105 - 100) = 750
        var p = Position(qty: 50, ltp: 100m, pnl: 500m);
        var mtm = MtmCalculator.Compute([p], _ => 105m);
        mtm.Should().Be(750m);
    }

    [Fact]
    public void Compute_MixedOpenAndClosed_SumsCorrectly()
    {
        var open   = Position(token: "OPEN",   qty: -25, ltp: 100m, pnl: 200m);   // +200 (no live ltp)
        var closed = Position(token: "CLOSED", qty: 0,   ltp: 50m,  pnl: 1_000m); // +1000
        var mtm = MtmCalculator.Compute([open, closed], _ => null);
        mtm.Should().Be(1_200m);
    }

    [Fact]
    public void Compute_WatchedProductsIntraday_FiltersOutDelivery()
    {
        var intraday = Position(token: "I", product: "I",    pnl: 100m);
        var delivery = Position(token: "D", product: "D",    pnl: 999m);
        var mis      = Position(token: "M", product: "MIS",  pnl: 50m);

        var mtm = MtmCalculator.Compute(
            [intraday, delivery, mis], _ => null, watchedProducts: "Intraday");

        mtm.Should().Be(150m);
    }

    [Fact]
    public void Compute_WatchedProductsAll_IncludesEverything()
    {
        var positions = new[]
        {
            Position(product: "I",   pnl: 100m),
            Position(product: "D",   pnl: 200m),
            Position(product: "CO",  pnl: 50m),
        };
        var mtm = MtmCalculator.Compute(positions, _ => null, watchedProducts: "All");
        mtm.Should().Be(350m);
    }

    [Fact]
    public void Compute_WatchedProductsNull_IncludesEverything()
    {
        var positions = new[]
        {
            Position(product: "I", pnl: 100m),
            Position(product: "D", pnl: 200m),
        };
        var mtm = MtmCalculator.Compute(positions, _ => null, watchedProducts: null);
        mtm.Should().Be(300m);
    }

    [Fact]
    public void ComputeWithBreakdown_RecordsCountsAndPerLineNotes()
    {
        var open    = Position(token: "O", qty: -10, ltp: 100m, pnl: 200m);
        var openLtp = Position(token: "L", qty: -10, ltp: 100m, pnl: 200m);
        var closed  = Position(token: "C", qty:   0, ltp:  50m, pnl: 500m);

        var breakdown = MtmCalculator.ComputeWithBreakdown(
            [open, openLtp, closed],
            token => token == "L" ? 110m : null);

        breakdown.OpenCount.Should().Be(2);
        breakdown.ClosedCount.Should().Be(1);
        breakdown.Lines.Should().HaveCount(3);
        // open without LTP: 200; open with LTP: 200 + (-10)(110-100) = 100; closed: 500
        breakdown.Total.Should().Be(800m);
        breakdown.Lines.Single(l => l.InstrumentToken == "C").Note.Should().Contain("closed");
        breakdown.Lines.Single(l => l.InstrumentToken == "L").Note.Should().Contain("liveAdj");
        breakdown.Lines.Single(l => l.InstrumentToken == "O").Note.Should().Contain("no live LTP");
    }

    [Fact]
    public void Compute_OpenPosition_LtpEqualsRef_NoAdjustment()
    {
        var p = Position(qty: -50, ltp: 100m, pnl: 500m);
        var mtm = MtmCalculator.Compute([p], _ => 100m);
        mtm.Should().Be(500m);
    }
}
