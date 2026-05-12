using KAITerminal.Broker;
using KAITerminal.RollingStraddle.Logic;
using KAITerminal.RollingStraddle.Models;

namespace KAITerminal.RollingStraddle.Services;

internal sealed class PositionLedger
{
    private readonly IBrokerPositionService _positions;

    public PositionLedger(IBrokerPositionService positions) => _positions = positions;

    internal async Task<(decimal Pnl, decimal CeLtp, decimal PeLtp)> FetchAsync(
        StrategyState state, CancellationToken ct)
    {
        var all = await _positions.GetAllPositionsAsync(ct);
        return PnlAggregator.Compute(all, state.TradedTokens, state.CeLeg?.Token, state.PeLeg?.Token);
    }

    /// <summary>
    /// Checks which legs still have open quantity at the broker.
    /// Used during graceful shutdown to avoid placing buy orders on already-closed positions.
    /// </summary>
    internal async Task<(bool CeOpen, bool PeOpen)> CheckLegsOpenAsync(
        StrategyState state, CancellationToken ct)
    {
        var all    = await _positions.GetAllPositionsAsync(ct);
        var ceOpen = state.CeLeg is { } ce &&
                     all.Any(p => p.InstrumentToken.Equals(ce.Token, StringComparison.OrdinalIgnoreCase)
                                  && p.Quantity != 0);
        var peOpen = state.PeLeg is { } pe &&
                     all.Any(p => p.InstrumentToken.Equals(pe.Token, StringComparison.OrdinalIgnoreCase)
                                  && p.Quantity != 0);
        return (ceOpen, peOpen);
    }
}
