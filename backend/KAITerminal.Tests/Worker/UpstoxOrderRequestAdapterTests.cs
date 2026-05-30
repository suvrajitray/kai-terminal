using FluentAssertions;
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Worker.OrderRouting;
using Xunit;

namespace KAITerminal.Tests.Worker;

public class UpstoxOrderRequestAdapterTests
{
    private static BrokerOrderRequest Request(
        string  transactionType = "SELL",
        string  orderType       = "MARKET",
        string  product         = "I",
        decimal? price          = null,
        string? tag             = null) =>
        new("NSE_FO|37590", Quantity: 50, transactionType, product, orderType, price, Tag: tag);

    [Theory]
    [InlineData("BUY",  TransactionType.Buy)]
    [InlineData("buy",  TransactionType.Buy)]
    [InlineData("SELL", TransactionType.Sell)]
    [InlineData("sell", TransactionType.Sell)]
    [InlineData("",     TransactionType.Sell)] // anything-not-BUY → Sell
    public void From_ParsesTransactionTypeCaseInsensitively(string input, TransactionType expected)
    {
        var result = UpstoxOrderRequestAdapter.From(Request(transactionType: input));
        result.TransactionType.Should().Be(expected);
    }

    [Theory]
    [InlineData("MARKET", OrderType.Market)]
    [InlineData("market", OrderType.Market)]
    [InlineData("LIMIT",  OrderType.Limit)]
    [InlineData("limit",  OrderType.Limit)]
    [InlineData("",       OrderType.Market)] // anything-not-LIMIT → Market
    public void From_ParsesOrderTypeCaseInsensitively(string input, OrderType expected)
    {
        var result = UpstoxOrderRequestAdapter.From(Request(orderType: input));
        result.OrderType.Should().Be(expected);
    }

    [Fact]
    public void From_NullPrice_BecomesZero()
    {
        var result = UpstoxOrderRequestAdapter.From(Request(price: null));
        result.Price.Should().Be(0m);
    }

    [Fact]
    public void From_NonNullPrice_PreservedAsIs()
    {
        var result = UpstoxOrderRequestAdapter.From(Request(price: 123.45m));
        result.Price.Should().Be(123.45m);
    }

    [Fact]
    public void From_SliceAlwaysTrue()
    {
        UpstoxOrderRequestAdapter.From(Request()).Slice.Should().BeTrue();
    }

    [Fact]
    public void From_TagPreserved()
    {
        var result = UpstoxOrderRequestAdapter.From(Request(tag: "ENTRY"));
        result.Tag.Should().Be("ENTRY");
    }

    [Fact]
    public void From_InstrumentTokenAndQuantityPreserved()
    {
        var result = UpstoxOrderRequestAdapter.From(Request());
        result.InstrumentToken.Should().Be("NSE_FO|37590");
        result.Quantity.Should().Be(50);
    }
}
