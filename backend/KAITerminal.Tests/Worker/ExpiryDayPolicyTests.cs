using FluentAssertions;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Worker.Jobs.AutoEntry;
using Xunit;

namespace KAITerminal.Tests.Worker;

public class ExpiryDayPolicyTests
{
    [Fact]
    public void OnlyExpiryDay_True_ReturnsOnly()
    {
        var config = new AutoEntryConfig { OnlyExpiryDay = true, ExcludeExpiryDay = false };
        config.ExpiryDayPolicy().Should().Be(ExpiryDayPolicy.Only);
    }

    [Fact]
    public void ExcludeExpiryDay_True_ReturnsExclude()
    {
        var config = new AutoEntryConfig { OnlyExpiryDay = false, ExcludeExpiryDay = true };
        config.ExpiryDayPolicy().Should().Be(ExpiryDayPolicy.Exclude);
    }

    [Fact]
    public void BothFalse_ReturnsAny()
    {
        var config = new AutoEntryConfig { OnlyExpiryDay = false, ExcludeExpiryDay = false };
        config.ExpiryDayPolicy().Should().Be(ExpiryDayPolicy.Any);
    }

    [Fact]
    public void BothTrue_OnlyTakesPrecedence()
    {
        // Conflicting config — Only wins because it's checked first.
        var config = new AutoEntryConfig { OnlyExpiryDay = true, ExcludeExpiryDay = true };
        config.ExpiryDayPolicy().Should().Be(ExpiryDayPolicy.Only);
    }
}
