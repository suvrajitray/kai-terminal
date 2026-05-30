using FluentAssertions;
using KAITerminal.Contracts;
using KAITerminal.Worker.Mapping;
using Xunit;

namespace KAITerminal.Tests.Worker;

public class CrossBrokerTokenMapperTests
{
    [Theory]
    [InlineData("NFO-OPT", "NSE_FO")]
    [InlineData("NFO-FUT", "NSE_FO")]
    [InlineData("BFO-OPT", "BSE_FO")]
    [InlineData("BFO-FUT", "BSE_FO")]
    public void SegmentToPrefix_KnownSegments_ReturnsExpectedPrefix(string segment, string expected)
    {
        CrossBrokerTokenMapper.SegmentToPrefix(segment).Should().Be(expected);
    }

    [Theory]
    [InlineData("NSE")]
    [InlineData("BSE")]
    [InlineData("MCX-OPT")]
    [InlineData("")]
    [InlineData("nfo-opt")]   // case-sensitive
    public void SegmentToPrefix_UnknownSegments_ReturnsNull(string segment)
    {
        CrossBrokerTokenMapper.SegmentToPrefix(segment).Should().BeNull();
    }

    [Theory]
    [InlineData("upstox", true)]
    [InlineData("UPSTOX", true)]
    [InlineData("Upstox", true)]
    [InlineData("zerodha", false)]
    [InlineData("", false)]
    public void IsUpstox_IsCaseInsensitive(string brokerType, bool expected)
    {
        CrossBrokerTokenMapper.IsUpstox(brokerType).Should().Be(expected);
    }

    [Fact]
    public void IsUpstox_MatchesBrokerNamesConstant()
    {
        CrossBrokerTokenMapper.IsUpstox(BrokerNames.Upstox).Should().BeTrue();
        CrossBrokerTokenMapper.IsUpstox(BrokerNames.Zerodha).Should().BeFalse();
    }
}
