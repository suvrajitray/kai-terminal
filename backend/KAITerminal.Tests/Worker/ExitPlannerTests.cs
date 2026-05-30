using FluentAssertions;
using KAITerminal.Contracts.Domain;
using KAITerminal.Worker.OrderRouting;
using Xunit;

namespace KAITerminal.Tests.Worker;

public class ExitPlannerTests
{
    private static BrokerPosition Position(
        string token    = "T",
        int    quantity = 0,
        string exchange = "NFO") => new()
    {
        InstrumentToken = token,
        Quantity        = quantity,
        Exchange        = exchange,
        Product         = "I",
    };

    [Fact]
    public void Plan_EmptyPositions_IsEmpty()
    {
        ExitPlanner.Plan([], exchanges: null).IsEmpty.Should().BeTrue();
    }

    [Fact]
    public void Plan_QuantityZero_IsExcluded()
    {
        var closed = Position(token: "C", quantity: 0);
        ExitPlanner.Plan([closed], exchanges: null).IsEmpty.Should().BeTrue();
    }

    [Fact]
    public void Plan_AllShorts_LongsIsEmpty()
    {
        var s1 = Position(token: "S1", quantity: -50);
        var s2 = Position(token: "S2", quantity: -25);
        var plan = ExitPlanner.Plan([s1, s2], exchanges: null);

        plan.Shorts.Should().HaveCount(2);
        plan.Longs.Should().BeEmpty();
        plan.IsEmpty.Should().BeFalse();
    }

    [Fact]
    public void Plan_AllLongs_ShortsIsEmpty()
    {
        var l1 = Position(token: "L1", quantity: 50);
        var l2 = Position(token: "L2", quantity: 100);
        var plan = ExitPlanner.Plan([l1, l2], exchanges: null);

        plan.Longs.Should().HaveCount(2);
        plan.Shorts.Should().BeEmpty();
    }

    [Fact]
    public void Plan_MixedShortsAndLongs_SplitsCorrectly()
    {
        var positions = new[]
        {
            Position(token: "L1", quantity:  50),
            Position(token: "S1", quantity: -50),
            Position(token: "L2", quantity:  25),
            Position(token: "S2", quantity: -75),
        };
        var plan = ExitPlanner.Plan(positions, exchanges: null);

        plan.Shorts.Select(p => p.InstrumentToken).Should().BeEquivalentTo(["S1", "S2"]);
        plan.Longs.Select(p => p.InstrumentToken).Should().BeEquivalentTo(["L1", "L2"]);
    }

    [Fact]
    public void Plan_ExchangeFilter_OnlyMatchingExchangesIncluded()
    {
        var positions = new[]
        {
            Position(token: "N1", quantity: -50, exchange: "NFO"),
            Position(token: "B1", quantity: -50, exchange: "BFO"),
            Position(token: "N2", quantity:  50, exchange: "NFO"),
        };
        var plan = ExitPlanner.Plan(positions, exchanges: ["BFO"]);

        plan.Shorts.Should().ContainSingle(p => p.InstrumentToken == "B1");
        plan.Longs.Should().BeEmpty();
    }

    [Fact]
    public void Plan_ExchangeFilter_IsCaseInsensitive()
    {
        var positions = new[] { Position(token: "N1", quantity: -50, exchange: "nfo") };
        var plan = ExitPlanner.Plan(positions, exchanges: ["NFO"]);
        plan.Shorts.Should().ContainSingle();
    }

    [Fact]
    public void Plan_EmptyExchangeFilter_BehavesLikeNoFilter()
    {
        var positions = new[]
        {
            Position(token: "N1", quantity: -50, exchange: "NFO"),
            Position(token: "B1", quantity: -50, exchange: "BFO"),
        };
        var plan = ExitPlanner.Plan(positions, exchanges: []);
        plan.Shorts.Should().HaveCount(2);
    }
}
