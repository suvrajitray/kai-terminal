using FluentAssertions;
using KAITerminal.Api.Dto.Enums;
using KAITerminal.Api.Mapping;
using KAITerminal.Contracts.Domain;
using Xunit;

namespace KAITerminal.Tests.Api;

public class PositionMapperTests
{
    // Helper: build a minimal BrokerPosition with just the product field set.
    private static BrokerPosition PositionWith(string product) =>
        new() { Product = product };

    // Helper: build a minimal BrokerOrder with specific fields set.
    private static BrokerOrder OrderWith(
        string product         = "I",
        string orderType       = "MARKET",
        string transactionType = "BUY",
        string validity        = "DAY")
        => new()
        {
            Product         = product,
            OrderType       = orderType,
            TransactionType = transactionType,
            Validity        = validity,
        };

    // ── Product type mapping (position) ───────────────────────────────────────

    [Theory]
    [InlineData("D")]
    [InlineData("CNC")]
    [InlineData("NRML")]
    public void Product_MapsToDelivery(string raw)
    {
        PositionWith(raw).ToResponse().Product.Should().Be(ProductType.Delivery);
    }

    [Fact]
    public void Product_MapsToMtf()
    {
        PositionWith("MTF").ToResponse().Product.Should().Be(ProductType.Mtf);
    }

    [Fact]
    public void Product_MapsToCoverOrder()
    {
        PositionWith("CO").ToResponse().Product.Should().Be(ProductType.CoverOrder);
    }

    [Theory]
    [InlineData("I")]
    [InlineData("MIS")]
    [InlineData("UNKNOWN")]
    public void Product_MapsToIntraday_ForIntradayAndUnknownValues(string raw)
    {
        PositionWith(raw).ToResponse().Product.Should().Be(ProductType.Intraday);
    }

    // ── Order type mapping ────────────────────────────────────────────────────

    [Fact]
    public void OrderType_MapsToLimit()
    {
        OrderWith(orderType: "LIMIT").ToResponse().OrderType.Should().Be(TradeOrderType.Limit);
    }

    [Fact]
    public void OrderType_MapsToStopLoss()
    {
        OrderWith(orderType: "SL").ToResponse().OrderType.Should().Be(TradeOrderType.StopLoss);
    }

    [Fact]
    public void OrderType_MapsToStopLossMarket()
    {
        OrderWith(orderType: "SL-M").ToResponse().OrderType.Should().Be(TradeOrderType.StopLossMarket);
    }

    [Theory]
    [InlineData("MARKET")]
    [InlineData("UNKNOWN")]
    public void OrderType_MapsToMarket_ForMarketAndUnknownValues(string raw)
    {
        OrderWith(orderType: raw).ToResponse().OrderType.Should().Be(TradeOrderType.Market);
    }

    // ── Order side mapping ────────────────────────────────────────────────────

    [Fact]
    public void TransactionType_MapsToSell()
    {
        OrderWith(transactionType: "SELL").ToResponse().TransactionType.Should().Be(OrderSide.Sell);
    }

    [Fact]
    public void TransactionType_MapsToBuy()
    {
        OrderWith(transactionType: "BUY").ToResponse().TransactionType.Should().Be(OrderSide.Buy);
    }

    [Fact]
    public void TransactionType_IsCaseInsensitive()
    {
        OrderWith(transactionType: "sell").ToResponse().TransactionType.Should().Be(OrderSide.Sell);
    }

    // ── Validity mapping ──────────────────────────────────────────────────────

    [Fact]
    public void Validity_MapsToIoc()
    {
        OrderWith(validity: "IOC").ToResponse().Validity.Should().Be(OrderValidity.IOC);
    }

    [Fact]
    public void Validity_MapsToDay_ForDayAndOtherValues()
    {
        OrderWith(validity: "DAY").ToResponse().Validity.Should().Be(OrderValidity.Day);
        OrderWith(validity: "UNKNOWN").ToResponse().Validity.Should().Be(OrderValidity.Day);
    }
}
