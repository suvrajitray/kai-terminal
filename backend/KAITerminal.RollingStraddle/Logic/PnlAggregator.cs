using KAITerminal.Contracts.Domain;

namespace KAITerminal.RollingStraddle.Logic;

internal static class PnlAggregator
{
    /// <summary>
    /// Aggregates P&amp;L and live LTPs from broker positions for the given traded tokens.
    /// Closed legs (Quantity=0) still carry Realised P&amp;L in the broker response.
    /// </summary>
    internal static (decimal Pnl, decimal CeLtp, decimal PeLtp) Compute(
        IReadOnlyList<BrokerPosition> positions,
        IReadOnlySet<string>          tokens,
        string?                       ceToken,
        string?                       peToken)
    {
        var ours  = positions.Where(p => tokens.Contains(p.InstrumentToken)).ToList();
        var pnl   = ours.Sum(p => p.Pnl);
        var ceLtp = FindLtp(ours, ceToken);
        var peLtp = FindLtp(ours, peToken);
        return (pnl, ceLtp, peLtp);
    }

    private static decimal FindLtp(IReadOnlyList<BrokerPosition> positions, string? token) =>
        token is null
            ? 0m
            : positions
                .FirstOrDefault(p => p.InstrumentToken.Equals(token, StringComparison.OrdinalIgnoreCase))
                ?.Ltp ?? 0m;
}
