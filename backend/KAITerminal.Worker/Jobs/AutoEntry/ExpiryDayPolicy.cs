using KAITerminal.Infrastructure.Data;

namespace KAITerminal.Worker.Jobs.AutoEntry;

internal enum ExpiryDayPolicy
{
    Any,
    Only,
    Exclude,
}

internal static class ExpiryDayPolicyExtensions
{
    public static ExpiryDayPolicy ExpiryDayPolicy(this AutoEntryConfig config) =>
        config.OnlyExpiryDay    ? AutoEntry.ExpiryDayPolicy.Only
      : config.ExcludeExpiryDay ? AutoEntry.ExpiryDayPolicy.Exclude
      : AutoEntry.ExpiryDayPolicy.Any;
}
