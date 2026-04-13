using FluentAssertions;
using KAITerminal.Contracts.Domain;
using Xunit;

namespace KAITerminal.Tests.Contracts;

public class ProductTypeFilterTests
{
    // ── "All" filter ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData("I")]
    [InlineData("D")]
    [InlineData("MIS")]
    [InlineData("NRML")]
    [InlineData("CO")]
    [InlineData("CNC")]
    public void All_PassesEveryProduct(string product)
    {
        ProductTypeFilter.Matches(product, "All").Should().BeTrue();
    }

    // ── "Intraday" filter ─────────────────────────────────────────────────────

    [Theory]
    [InlineData("I")]
    [InlineData("MIS")]
    public void Intraday_PassesIntradayProducts(string product)
    {
        ProductTypeFilter.Matches(product, "Intraday").Should().BeTrue();
    }

    [Theory]
    [InlineData("D")]
    [InlineData("NRML")]
    [InlineData("CO")]
    [InlineData("CNC")]
    public void Intraday_BlocksNonIntradayProducts(string product)
    {
        ProductTypeFilter.Matches(product, "Intraday").Should().BeFalse();
    }

    [Fact]
    public void Intraday_IsCaseInsensitive()
    {
        ProductTypeFilter.Matches("mis", "Intraday").Should().BeTrue();
        ProductTypeFilter.Matches("i", "Intraday").Should().BeTrue();
    }

    // ── "Delivery" filter ─────────────────────────────────────────────────────

    [Theory]
    [InlineData("D")]
    [InlineData("NRML")]
    public void Delivery_PassesDeliveryProducts(string product)
    {
        ProductTypeFilter.Matches(product, "Delivery").Should().BeTrue();
    }

    [Theory]
    [InlineData("I")]
    [InlineData("MIS")]
    [InlineData("CO")]
    [InlineData("CNC")]
    public void Delivery_BlocksNonDeliveryProducts(string product)
    {
        ProductTypeFilter.Matches(product, "Delivery").Should().BeFalse();
    }

    [Fact]
    public void Delivery_IsCaseInsensitive()
    {
        ProductTypeFilter.Matches("nrml", "Delivery").Should().BeTrue();
        ProductTypeFilter.Matches("d", "Delivery").Should().BeTrue();
    }
}
