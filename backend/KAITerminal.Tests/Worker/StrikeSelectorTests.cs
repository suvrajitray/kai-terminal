using FluentAssertions;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Worker.Jobs.AutoEntry;
using Xunit;

namespace KAITerminal.Tests.Worker;

public class StrikeSelectorTests
{
    private static ContractEntry Entry(
        decimal strike,
        string  instrumentType = "CE",
        string  expiry         = "2026-06-25",
        string  upstoxToken    = "",
        string  zerodhaToken   = "") =>
        new(
            Expiry:         expiry,
            ExchangeToken:  $"ex_{(int)strike}",
            LotSize:        50,
            InstrumentType: instrumentType,
            UpstoxToken:    string.IsNullOrEmpty(upstoxToken)  ? $"NSE_FO|ut_{(int)strike}_{instrumentType}" : upstoxToken,
            ZerodhaToken:   string.IsNullOrEmpty(zerodhaToken) ? $"NIFTY26JUN{(int)strike}{instrumentType}"  : zerodhaToken,
            StrikePrice:    strike);

    private static AutoEntryConfig Config(
        string  brokerType  = BrokerNames.Upstox,
        string  instrument  = "NIFTY",
        decimal strikeParam = 1m) => new()
    {
        BrokerType  = brokerType,
        Instrument  = instrument,
        StrikeParam = strikeParam,
    };

    private static StrikeSelectionContext Context(
        decimal              spot,
        IReadOnlyList<ContractEntry> contracts,
        string               optionType = "CE",
        AutoEntryConfig?     config     = null,
        string               expiry     = "2026-06-25") =>
        new(config ?? Config(), optionType, expiry, spot, contracts);

    // ── AtmStrikeSelector ───────────────────────────────────────────────────

    [Fact]
    public async Task Atm_PicksStrikeNearestSpot()
    {
        var contracts = new[] { Entry(21_900m), Entry(22_000m), Entry(22_100m) };
        var resolution = await new AtmStrikeSelector().SelectAsync(
            Context(spot: 22_050m, contracts), CancellationToken.None);

        // 22_050 is equidistant from 22000 and 22100, but MinBy picks the first match (22_000)
        resolution!.Token.Should().Be("NSE_FO|ut_22000_CE");
    }

    [Fact]
    public async Task Atm_SingleStrike_PicksIt()
    {
        var contracts = new[] { Entry(22_000m) };
        var resolution = await new AtmStrikeSelector().SelectAsync(
            Context(spot: 24_000m, contracts), CancellationToken.None);
        resolution!.Token.Should().Be("NSE_FO|ut_22000_CE");
    }

    [Fact]
    public async Task Atm_EmptyContracts_ReturnsNull()
    {
        var resolution = await new AtmStrikeSelector().SelectAsync(
            Context(spot: 22_000m, contracts: []), CancellationToken.None);
        resolution.Should().BeNull();
    }

    [Fact]
    public async Task Atm_FiltersByExpiryAndOptionType()
    {
        var contracts = new[]
        {
            Entry(22_000m, instrumentType: "PE"),
            Entry(22_000m, instrumentType: "CE", expiry: "2099-12-31"),
            Entry(22_100m, instrumentType: "CE"),
        };
        var resolution = await new AtmStrikeSelector().SelectAsync(
            Context(spot: 22_000m, contracts), CancellationToken.None);
        resolution!.Token.Should().Be("NSE_FO|ut_22100_CE");
    }

    // ── OtmStrikeSelector ───────────────────────────────────────────────────

    [Fact]
    public async Task Otm_Ce_PicksHigherStrike()
    {
        var contracts = new[]
        {
            Entry(21_900m), Entry(22_000m), Entry(22_100m), Entry(22_200m),
        };
        var resolution = await new OtmStrikeSelector().SelectAsync(
            Context(spot: 22_000m, contracts, optionType: "CE",
                config: Config(strikeParam: 1m)),
            CancellationToken.None);

        // ATM=22_000 (index 1), +1 step → 22_100 (index 2)
        resolution!.Token.Should().Be("NSE_FO|ut_22100_CE");
    }

    [Fact]
    public async Task Otm_Pe_PicksLowerStrike()
    {
        var contracts = new[]
        {
            Entry(21_900m, "PE"), Entry(22_000m, "PE"),
            Entry(22_100m, "PE"), Entry(22_200m, "PE"),
        };
        var resolution = await new OtmStrikeSelector().SelectAsync(
            Context(spot: 22_100m, contracts, optionType: "PE",
                config: Config(strikeParam: 1m)),
            CancellationToken.None);

        // ATM=22_100 (index 2), -1 step → 22_000 (index 1)
        resolution!.Token.Should().Be("NSE_FO|ut_22000_PE");
    }

    [Fact]
    public async Task Otm_ClampsToUpperBound()
    {
        var contracts = new[] { Entry(22_000m), Entry(22_100m) };
        // Spot at 22_000 → ATM index 0; OTM CE +5 would overflow → clamps to index 1 (22_100)
        var resolution = await new OtmStrikeSelector().SelectAsync(
            Context(spot: 22_000m, contracts, optionType: "CE",
                config: Config(strikeParam: 5m)),
            CancellationToken.None);
        resolution!.Token.Should().Be("NSE_FO|ut_22100_CE");
    }

    [Fact]
    public async Task Otm_ClampsToLowerBound()
    {
        var contracts = new[] { Entry(22_000m, "PE"), Entry(22_100m, "PE") };
        // Spot at 22_100 → ATM index 1; OTM PE -5 would underflow → clamps to index 0 (22_000)
        var resolution = await new OtmStrikeSelector().SelectAsync(
            Context(spot: 22_100m, contracts, optionType: "PE",
                config: Config(strikeParam: 5m)),
            CancellationToken.None);
        resolution!.Token.Should().Be("NSE_FO|ut_22000_PE");
    }
}
