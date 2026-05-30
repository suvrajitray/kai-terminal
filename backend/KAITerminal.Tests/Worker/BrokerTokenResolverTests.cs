using FluentAssertions;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Options;
using KAITerminal.Worker.Jobs.AutoEntry;
using Xunit;

namespace KAITerminal.Tests.Worker;

public class BrokerTokenResolverTests
{
    private static ContractEntry Entry(
        string  upstoxToken  = "NSE_FO|37590",
        string  zerodhaToken = "NIFTY26JUN22000CE",
        decimal strike       = 22_000m) =>
        new(
            Expiry:         "2026-06-25",
            ExchangeToken:  "37590",
            LotSize:        50,
            InstrumentType: "CE",
            UpstoxToken:    upstoxToken,
            ZerodhaToken:   zerodhaToken,
            StrikePrice:    strike);

    // ── FromContract ─────────────────────────────────────────────────────────

    [Fact]
    public void FromContract_Upstox_ReturnsUpstoxTokenWithNullExchange()
    {
        var resolution = BrokerTokenResolver.FromContract(Entry(), BrokerNames.Upstox, "NIFTY");
        resolution.Should().NotBeNull();
        resolution!.Token.Should().Be("NSE_FO|37590");
        resolution.Exchange.Should().BeNull();
    }

    [Fact]
    public void FromContract_Zerodha_NifyInstrument_ReturnsNfoExchange()
    {
        var resolution = BrokerTokenResolver.FromContract(Entry(), BrokerNames.Zerodha, "NIFTY");
        resolution.Should().NotBeNull();
        resolution!.Token.Should().Be("NIFTY26JUN22000CE");
        resolution.Exchange.Should().Be("NFO");
    }

    [Fact]
    public void FromContract_Zerodha_SensexInstrument_ReturnsBfoExchange()
    {
        var resolution = BrokerTokenResolver.FromContract(Entry(), BrokerNames.Zerodha, "SENSEX");
        resolution!.Exchange.Should().Be("BFO");
    }

    [Fact]
    public void FromContract_Zerodha_BankexInstrument_ReturnsBfoExchange()
    {
        var resolution = BrokerTokenResolver.FromContract(Entry(), BrokerNames.Zerodha, "BANKEX");
        resolution!.Exchange.Should().Be("BFO");
    }

    [Fact]
    public void FromContract_Zerodha_EmptyZerodhaToken_ReturnsNull()
    {
        var entry = Entry(zerodhaToken: "");
        var resolution = BrokerTokenResolver.FromContract(entry, BrokerNames.Zerodha, "NIFTY");
        resolution.Should().BeNull();
    }

    // ── FromUpstoxKey ────────────────────────────────────────────────────────

    [Fact]
    public void FromUpstoxKey_Upstox_NormalisesColonToPipe()
    {
        var resolution = BrokerTokenResolver.FromUpstoxKey(
            "NSE_FO:37590", BrokerNames.Upstox, [], "NIFTY");
        resolution!.Token.Should().Be("NSE_FO|37590");
        resolution.Exchange.Should().BeNull();
    }

    [Fact]
    public void FromUpstoxKey_Zerodha_MatchingExchangeToken_ReturnsZerodhaToken()
    {
        var contracts = new[] { Entry(upstoxToken: "NSE_FO|37590", zerodhaToken: "NIFTY26JUN22000CE") };
        var resolution = BrokerTokenResolver.FromUpstoxKey(
            "NSE_FO:37590", BrokerNames.Zerodha, contracts, "NIFTY");
        resolution!.Token.Should().Be("NIFTY26JUN22000CE");
        resolution.Exchange.Should().Be("NFO");
    }

    [Fact]
    public void FromUpstoxKey_Zerodha_NoMatch_ReturnsNull()
    {
        var contracts = new[] { Entry(upstoxToken: "NSE_FO|99999", zerodhaToken: "OTHER") };
        var resolution = BrokerTokenResolver.FromUpstoxKey(
            "NSE_FO:37590", BrokerNames.Zerodha, contracts, "NIFTY");
        resolution.Should().BeNull();
    }

    [Fact]
    public void FromUpstoxKey_Zerodha_MatchedButZerodhaTokenEmpty_ReturnsNull()
    {
        var contracts = new[] { Entry(upstoxToken: "NSE_FO|37590", zerodhaToken: "") };
        var resolution = BrokerTokenResolver.FromUpstoxKey(
            "NSE_FO:37590", BrokerNames.Zerodha, contracts, "NIFTY");
        resolution.Should().BeNull();
    }

    [Fact]
    public void FromUpstoxKey_Zerodha_SensexInstrument_ReturnsBfoExchange()
    {
        var contracts = new[] { Entry(upstoxToken: "BSE_FO|37590", zerodhaToken: "SENSEX26JUN80000CE") };
        var resolution = BrokerTokenResolver.FromUpstoxKey(
            "BSE_FO:37590", BrokerNames.Zerodha, contracts, "SENSEX");
        resolution!.Exchange.Should().Be("BFO");
    }
}
