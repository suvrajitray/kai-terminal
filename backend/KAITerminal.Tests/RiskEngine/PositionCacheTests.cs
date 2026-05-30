using FluentAssertions;
using KAITerminal.Contracts.Domain;
using KAITerminal.RiskEngine.State;
using Xunit;

namespace KAITerminal.Tests.RiskEngine;

public class PositionCacheTests
{
    private const string User = "alice@example.com::upstox";

    private static BrokerPosition Position(
        string token    = "NSE_FO|1",
        int    quantity = -50,
        decimal pnl     = 100m) => new()
    {
        InstrumentToken = token,
        Quantity        = quantity,
        Pnl             = pnl,
        Product         = "I",
    };

    [Fact]
    public void UpdateLtp_NonPositive_IsIgnored()
    {
        var cache = new PositionCache();
        cache.UpdatePositions(User, [Position(token: "T")]);

        cache.UpdateLtp(User, "T",  0m);
        cache.UpdateLtp(User, "T", -5m);

        cache.TryGetLiveLtp(User, "T").Should().BeNull();
    }

    [Fact]
    public void UpdateLtp_Positive_IsStored()
    {
        var cache = new PositionCache();
        cache.UpdatePositions(User, [Position(token: "T")]);
        cache.UpdateLtp(User, "T", 123.45m);

        cache.TryGetLiveLtp(User, "T").Should().Be(123.45m);
    }

    [Fact]
    public void UpdatePositions_EvictsLtpForTokensNoLongerPresent()
    {
        var cache = new PositionCache();
        cache.UpdatePositions(User, [Position(token: "OLD"), Position(token: "KEEP")]);
        cache.UpdateLtp(User, "OLD", 100m);
        cache.UpdateLtp(User, "KEEP", 200m);

        // Next poll: "OLD" no longer present
        cache.UpdatePositions(User, [Position(token: "KEEP")]);

        cache.TryGetLiveLtp(User, "OLD").Should().BeNull();
        cache.TryGetLiveLtp(User, "KEEP").Should().Be(200m); // preserved
    }

    [Fact]
    public void UpdatePositions_ClearsShiftedTokens()
    {
        var cache = new PositionCache();
        cache.UpdatePositions(User, [Position(token: "T")]);
        cache.MarkShifted(User, "T");
        cache.IsShifted(User, "T").Should().BeTrue();

        cache.UpdatePositions(User, [Position(token: "T")]);

        cache.IsShifted(User, "T").Should().BeFalse();
    }

    [Fact]
    public void ResetLtp_ClearsOnlyForSpecifiedUser()
    {
        var cache = new PositionCache();
        cache.UpdatePositions("u1", [Position(token: "T")]);
        cache.UpdatePositions("u2", [Position(token: "T")]);
        cache.UpdateLtp("u1", "T", 100m);
        cache.UpdateLtp("u2", "T", 200m);

        cache.ResetLtp("u1");

        cache.TryGetLiveLtp("u1", "T").Should().BeNull();
        cache.TryGetLiveLtp("u2", "T").Should().Be(200m);
    }

    [Fact]
    public void GetOpenInstrumentTokens_ExcludesZeroQuantity()
    {
        var cache = new PositionCache();
        cache.UpdatePositions(User, [
            Position(token: "OPEN1", quantity: -50),
            Position(token: "CLOSED", quantity: 0),
            Position(token: "OPEN2", quantity: 100),
        ]);

        cache.GetOpenInstrumentTokens(User).Should().BeEquivalentTo(["OPEN1", "OPEN2"]);
    }

    [Fact]
    public void GetMtm_UnknownUser_ReturnsZero()
    {
        new PositionCache().GetMtm("nobody").Should().Be(0m);
    }

    [Fact]
    public void GetEffectiveLtp_FallsBackWhenNoLiveTick()
    {
        var cache = new PositionCache();
        cache.UpdatePositions(User, [Position(token: "T")]);

        cache.GetEffectiveLtp(User, "T", fallback: 99m).Should().Be(99m);

        cache.UpdateLtp(User, "T", 100m);
        cache.GetEffectiveLtp(User, "T", fallback: 99m).Should().Be(100m);
    }
}
