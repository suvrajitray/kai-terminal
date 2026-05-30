using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;

namespace KAITerminal.RiskEngine.Services;

/// <summary>
/// Pure MTM aggregation. Closed positions contribute their broker-reported realised P&amp;L;
/// open positions enhance the broker P&amp;L with the incremental delta from a live LTP feed
/// when one is available, falling back to the broker P&amp;L otherwise.
/// </summary>
public static class MtmCalculator
{
    /// <summary>
    /// Computes total MTM across <paramref name="positions"/>.
    /// </summary>
    /// <param name="positions">Positions to aggregate.</param>
    /// <param name="getLiveLtp">Returns the live feed LTP for a token, or null if unavailable.</param>
    /// <param name="watchedProducts">Optional filter; null/empty means include all.</param>
    public static decimal Compute(
        IEnumerable<BrokerPosition> positions,
        Func<string, decimal?>      getLiveLtp,
        string?                     watchedProducts = null)
    {
        decimal total = 0m;
        foreach (var p in positions)
        {
            if (!IncludesProduct(watchedProducts, p.Product)) continue;
            total += ContributionOf(p, getLiveLtp);
        }
        return total;
    }

    /// <summary>
    /// Like <see cref="Compute"/>, but also returns per-position contribution breakdowns
    /// for diagnostic logging.
    /// </summary>
    public static MtmBreakdown ComputeWithBreakdown(
        IEnumerable<BrokerPosition> positions,
        Func<string, decimal?>      getLiveLtp,
        string?                     watchedProducts = null)
    {
        decimal total = 0m;
        int     open = 0, closed = 0;
        var     lines = new List<MtmLine>();

        foreach (var p in positions)
        {
            if (!IncludesProduct(watchedProducts, p.Product)) continue;

            decimal contribution;
            string  note;

            if (!p.IsOpen)
            {
                contribution = p.Pnl;
                note         = "closed — realized pnl";
                closed++;
            }
            else
            {
                var liveLtp = getLiveLtp(p.InstrumentToken);
                if (liveLtp.HasValue)
                {
                    var adj = p.Quantity * (liveLtp.Value - p.Ltp);
                    contribution = p.Pnl + adj;
                    note = $"open — brokerPnl ₹{p.Pnl:+#,##0;-#,##0} + liveAdj ₹{adj:+#,##0;-#,##0} (ltp={liveLtp.Value} ref={p.Ltp})";
                }
                else
                {
                    contribution = p.Pnl;
                    note         = "open — no live LTP, using broker pnl";
                }
                open++;
            }

            total += contribution;
            lines.Add(new MtmLine(p.InstrumentToken, p.Quantity, note, contribution));
        }

        return new MtmBreakdown(total, open, closed, lines);
    }

    private static decimal ContributionOf(BrokerPosition p, Func<string, decimal?> getLiveLtp)
    {
        if (!p.IsOpen) return p.Pnl;
        var ltp = getLiveLtp(p.InstrumentToken);
        return ltp.HasValue ? p.Pnl + p.Quantity * (ltp.Value - p.Ltp) : p.Pnl;
    }

    private static bool IncludesProduct(string? watchedProducts, string product) =>
        string.IsNullOrEmpty(watchedProducts) || ProductTypeFilter.Matches(product, watchedProducts);
}

public sealed record MtmBreakdown(
    decimal              Total,
    int                  OpenCount,
    int                  ClosedCount,
    IReadOnlyList<MtmLine> Lines);

public sealed record MtmLine(
    string  InstrumentToken,
    int     Quantity,
    string  Note,
    decimal Contribution);
