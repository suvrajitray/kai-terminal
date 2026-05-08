using KAITerminal.Broker;
using KAITerminal.RollingStraddle.Logic;
using KAITerminal.RollingStraddle.Models;

namespace KAITerminal.RollingStraddle.Services;

internal sealed class PositionLedger
{
    private readonly IBrokerPositionService _positions;

    public PositionLedger(IBrokerPositionService positions) => _positions = positions;

    internal async Task<(decimal Pnl, decimal CeLtp, decimal PeLtp)> FetchAsync(
        StraddleState state, CancellationToken ct)
    {
        var all = await _positions.GetAllPositionsAsync(ct);
        return PnlAggregator.Compute(all, state.TradedTokens, state.CeLeg?.Token, state.PeLeg?.Token);
    }
}
