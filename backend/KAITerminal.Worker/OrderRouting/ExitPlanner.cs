using KAITerminal.Contracts.Domain;

namespace KAITerminal.Worker.OrderRouting;

/// <summary>
/// Pure exit planning: groups open positions into shorts-first then longs so margin
/// is released before covering, optionally filtered to a set of exchanges.
/// </summary>
internal static class ExitPlanner
{
    public static ExitPlan Plan(
        IReadOnlyList<BrokerPosition> positions,
        IReadOnlyCollection<string>?  exchanges)
    {
        var open = positions.Where(p => p.Quantity != 0);

        if (exchanges is { Count: > 0 })
        {
            var allowed = exchanges.Select(e => e.ToUpperInvariant()).ToHashSet();
            open = open.Where(p => allowed.Contains(p.Exchange.ToUpperInvariant()));
        }

        var openList = open.ToList();
        var shorts   = openList.Where(p => p.Quantity < 0).ToList();
        var longs    = openList.Where(p => p.Quantity > 0).ToList();

        return new ExitPlan(shorts, longs);
    }
}

internal sealed record ExitPlan(
    IReadOnlyList<BrokerPosition> Shorts,
    IReadOnlyList<BrokerPosition> Longs)
{
    public bool IsEmpty => Shorts.Count == 0 && Longs.Count == 0;
}
