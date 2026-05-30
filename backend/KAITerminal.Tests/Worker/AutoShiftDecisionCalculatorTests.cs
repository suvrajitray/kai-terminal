using FluentAssertions;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Models;
using KAITerminal.RiskEngine.Models;
using KAITerminal.Worker;
using Xunit;

namespace KAITerminal.Tests.Worker;

public class AutoShiftDecisionCalculatorTests
{
    private static BrokerPosition SellPosition(
        string  token        = "NSE_FO|12345",
        int     qty          = -50,
        decimal averagePrice = 100m) => new()
    {
        InstrumentToken = token,
        Quantity        = qty,
        AveragePrice    = averagePrice,
        Product         = "I",
    };

    private static ZerodhaOptionContract Contract(
        string  name           = "NIFTY",
        string  expiry         = "2026-06-25",
        string  instrumentType = "CE",
        decimal strike         = 22_000m,
        string  exchangeToken  = "12345",
        string  tradingSymbol  = "NIFTY26JUN22000CE",
        string  segment        = "NFO-OPT",
        string  exchange       = "NFO") => new(
        InstrumentToken: "9999",
        ExchangeToken:   exchangeToken,
        TradingSymbol:   tradingSymbol,
        Name:            name,
        LastPrice:       0m,
        Expiry:          expiry,
        Strike:          strike,
        TickSize:        0.05m,
        LotSize:         50,
        InstrumentType:  instrumentType,
        Segment:         segment,
        Exchange:        exchange,
        Weekly:          false);

    private static UserConfig Config(
        int     maxShifts     = 2,
        decimal thresholdPct  = 30m,
        int     strikeGap     = 1) => new()
    {
        AutoShiftMaxCount     = maxShifts,
        AutoShiftThresholdPct = thresholdPct,
        AutoShiftStrikeGap    = strikeGap,
    };

    // ── FilterThresholdCrossings ─────────────────────────────────────────────

    [Fact]
    public void Filter_LtpBelowThreshold_IsExcluded()
    {
        var pos = SellPosition(averagePrice: 100m);
        // Threshold = 100 × 1.30 = 130. LTP 129 → below threshold.
        var crossings = AutoShiftDecisionCalculator.FilterThresholdCrossings(
            [pos], _ => 129m, _ => false, Config(thresholdPct: 30m));
        crossings.Should().BeEmpty();
    }

    [Fact]
    public void Filter_LtpAtThreshold_IsIncluded()
    {
        var pos = SellPosition(averagePrice: 100m);
        var crossings = AutoShiftDecisionCalculator.FilterThresholdCrossings(
            [pos], _ => 130m, _ => false, Config(thresholdPct: 30m));
        crossings.Should().ContainSingle().Which.Ltp.Should().Be(130m);
    }

    [Fact]
    public void Filter_LtpAboveThreshold_IsIncluded()
    {
        var pos = SellPosition(averagePrice: 100m);
        var crossings = AutoShiftDecisionCalculator.FilterThresholdCrossings(
            [pos], _ => 150m, _ => false, Config(thresholdPct: 30m));
        crossings.Should().ContainSingle();
    }

    [Fact]
    public void Filter_AlreadyShiftedThisCycle_IsExcluded()
    {
        var pos = SellPosition(token: "X", averagePrice: 100m);
        var crossings = AutoShiftDecisionCalculator.FilterThresholdCrossings(
            [pos], _ => 200m, token => token == "X", Config());
        crossings.Should().BeEmpty();
    }

    [Fact]
    public void Filter_LtpNull_IsExcluded()
    {
        var pos = SellPosition(averagePrice: 100m);
        var crossings = AutoShiftDecisionCalculator.FilterThresholdCrossings(
            [pos], _ => null, _ => false, Config());
        crossings.Should().BeEmpty();
    }

    // ── Evaluate ─────────────────────────────────────────────────────────────

    [Fact]
    public void Evaluate_ContractNotFound_ReturnsSkipContractNotFound()
    {
        var pos = SellPosition(token: "NSE_FO|99999");
        var decisions = AutoShiftDecisionCalculator.Evaluate(
            [(pos, 200m)],
            new UserRiskState().ToSnapshot(),
            Config(),
            contracts: [],
            brokerType: "upstox");

        decisions.Should().ContainSingle()
            .Which.Kind.Should().Be(AutoShiftDecisionKind.SkipContractNotFound);
    }

    [Fact]
    public void Evaluate_ShiftCountAtMax_ReturnsExitExhausted()
    {
        var contract = Contract(exchangeToken: "12345");
        var pos = SellPosition(token: "NSE_FO|12345");

        var state = new UserRiskState();
        var chainKey = $"{contract.Name}_{contract.Expiry}_{contract.InstrumentType}_{contract.Strike}";
        state.IncrementAutoShiftCount(chainKey);
        state.IncrementAutoShiftCount(chainKey); // 2 shifts done, max is 2

        var decisions = AutoShiftDecisionCalculator.Evaluate(
            [(pos, 200m)],
            state.ToSnapshot(),
            Config(maxShifts: 2),
            [contract],
            brokerType: "upstox");

        var decision = decisions.Should().ContainSingle().Subject;
        decision.Kind.Should().Be(AutoShiftDecisionKind.ExitExhausted);
        decision.ShiftCount.Should().Be(2);
        decision.MaxShiftCount.Should().Be(2);
        decision.ChainKey.Should().Be(chainKey);
    }

    [Fact]
    public void Evaluate_ShiftCountBelowMax_ReturnsShift()
    {
        var contract = Contract(exchangeToken: "12345", instrumentType: "CE");
        var pos = SellPosition(token: "NSE_FO|12345");

        var decisions = AutoShiftDecisionCalculator.Evaluate(
            [(pos, 200m)],
            new UserRiskState().ToSnapshot(),
            Config(maxShifts: 3, strikeGap: 2),
            [contract],
            brokerType: "upstox");

        var decision = decisions.Should().ContainSingle().Subject;
        decision.Kind.Should().Be(AutoShiftDecisionKind.Shift);
        decision.StrikeGap.Should().Be(2);   // CE → positive
        decision.UnderlyingKey.Should().Be("NSE_INDEX|Nifty 50");
        decision.IsShiftedLeg.Should().BeFalse();
    }

    [Fact]
    public void Evaluate_PeContract_HasNegativeStrikeGap()
    {
        var contract = Contract(exchangeToken: "12345", instrumentType: "PE");
        var pos = SellPosition(token: "NSE_FO|12345");

        var decisions = AutoShiftDecisionCalculator.Evaluate(
            [(pos, 200m)],
            new UserRiskState().ToSnapshot(),
            Config(strikeGap: 1),
            [contract],
            brokerType: "upstox");

        decisions.Single().StrikeGap.Should().Be(-1);
    }

    [Fact]
    public void Evaluate_UnknownUnderlying_ReturnsSkipUnknownUnderlying()
    {
        var contract = Contract(name: "UNKNOWN_INDEX", exchangeToken: "12345");
        var pos = SellPosition(token: "NSE_FO|12345");

        var decisions = AutoShiftDecisionCalculator.Evaluate(
            [(pos, 200m)],
            new UserRiskState().ToSnapshot(),
            Config(),
            [contract],
            brokerType: "upstox");

        decisions.Single().Kind.Should().Be(AutoShiftDecisionKind.SkipUnknownUnderlying);
    }

    [Fact]
    public void Evaluate_ChainAlreadyExited_IsSilentlySkipped()
    {
        var contract = Contract(exchangeToken: "12345");
        var pos = SellPosition(token: "NSE_FO|12345");

        var state = new UserRiskState();
        var chainKey = $"{contract.Name}_{contract.Expiry}_{contract.InstrumentType}_{contract.Strike}";
        // Push past max so the ExitExhausted branch is reached, then mark chain as already exited
        state.IncrementAutoShiftCount(chainKey);
        state.IncrementAutoShiftCount(chainKey);
        state.MarkChainExited(chainKey);

        var decisions = AutoShiftDecisionCalculator.Evaluate(
            [(pos, 200m)],
            state.ToSnapshot(),
            Config(maxShifts: 2),
            [contract],
            brokerType: "upstox");

        decisions.Should().BeEmpty();
    }

    [Fact]
    public void Evaluate_ShiftedLeg_InheritsOriginalChainKey()
    {
        var contract = Contract(exchangeToken: "12345", strike: 22_200m); // new leg post-shift
        var pos = SellPosition(token: "NSE_FO|12345");

        var state = new UserRiskState();
        var originalChainKey = "NIFTY_2026-06-25_CE_22000";
        state.MapShiftOrigin("NSE_FO|12345", originalChainKey);
        state.IncrementAutoShiftCount(originalChainKey); // 1 shift used

        var decisions = AutoShiftDecisionCalculator.Evaluate(
            [(pos, 200m)],
            state.ToSnapshot(),
            Config(maxShifts: 2),
            [contract],
            brokerType: "upstox");

        var decision = decisions.Should().ContainSingle().Subject;
        decision.Kind.Should().Be(AutoShiftDecisionKind.Shift);
        decision.ChainKey.Should().Be(originalChainKey);
        decision.IsShiftedLeg.Should().BeTrue();
        decision.ShiftCount.Should().Be(1);
    }

    [Fact]
    public void Evaluate_ZerodhaPosition_MatchesByTradingSymbol()
    {
        var contract = Contract(tradingSymbol: "NIFTY26JUN22000CE", exchangeToken: "12345");
        // For Zerodha, InstrumentToken IS the trading symbol
        var pos = SellPosition(token: "NIFTY26JUN22000CE");

        var decisions = AutoShiftDecisionCalculator.Evaluate(
            [(pos, 200m)],
            new UserRiskState().ToSnapshot(),
            Config(),
            [contract],
            brokerType: "zerodha");

        decisions.Single().Kind.Should().Be(AutoShiftDecisionKind.Shift);
    }
}
