using System.Text;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Models;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Responses;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Services;

/// <summary>
/// Evaluates portfolio-level risk for a single user.
/// Call <see cref="EvaluateAsync"/> inside a <c>UpstoxTokenContext.Use(token)</c> scope.
/// </summary>
public sealed class RiskEvaluator
{
    private readonly UpstoxClient _upstox;
    private readonly IRiskRepository _repo;
    private readonly RiskEngineConfig _cfg;
    private readonly ILogger<RiskEvaluator> _logger;

    public RiskEvaluator(
        UpstoxClient upstox,
        IRiskRepository repo,
        IOptions<RiskEngineConfig> cfg,
        ILogger<RiskEvaluator> logger)
    {
        _upstox = upstox;
        _repo = repo;
        _cfg = cfg.Value;
        _logger = logger;
    }

    public async Task EvaluateAsync(string userId, CancellationToken ct = default)
    {
        var state = _repo.GetOrCreate(userId);

        if (state.IsSquaredOff)
        {
            _logger.LogDebug("Portfolio check skipped for userId={UserId}: already squared off", userId);
            return;
        }

        IReadOnlyList<Position> positions;
        try
        {
            positions = await _upstox.GetAllPositionsAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Portfolio check: failed to fetch positions for userId={UserId}", userId);
            return;
        }

        decimal mtm = positions.Sum(p => p.Pnl);

        _logger.LogInformation(
            "Portfolio check: userId={UserId} MTM={Mtm:+0.##;-0.##}\n{Table}",
            userId, mtm, BuildPositionsTable(positions));

        // ── 1. Hard stop loss ────────────────────────────────────────────────
        if (mtm <= _cfg.HardStopLoss)
        {
            _logger.LogWarning(
                "Hard stop loss triggered for userId={UserId} (MTM={Mtm}) — exiting all positions",
                userId, mtm);
            await SquareOffAsync(userId, state, ct);
            return;
        }

        // ── 2. Profit target ─────────────────────────────────────────────────
        if (mtm >= _cfg.ProfitTarget)
        {
            _logger.LogInformation(
                "Profit target reached for userId={UserId} (MTM={Mtm}) — exiting all positions",
                userId, mtm);
            await SquareOffAsync(userId, state, ct);
            return;
        }

        // ── 3. Trailing stop loss ────────────────────────────────────────────
        if (!state.TrailingActive)
        {
            if (mtm >= _cfg.TrailingActivationThreshold)
            {
                state.TrailingActive = true;
                state.TrailingStop = mtm - _cfg.TrailingInitialLock;
                state.TrailingLastTrigger = mtm;
                _repo.Update(userId, state);
                _logger.LogInformation(
                    "Trailing SL activated for userId={UserId}: stop={Stop}, lastTrigger={LastTrigger}",
                    userId, state.TrailingStop, state.TrailingLastTrigger);
            }
        }
        else
        {
            // Raise the trailing stop if MTM has moved up by StepGain since last trigger
            decimal gain = mtm - state.TrailingLastTrigger;
            if (gain >= _cfg.TrailingStepGain)
            {
                long steps = (long)(gain / _cfg.TrailingStepGain);
                state.TrailingStop += steps * _cfg.TrailingStepLock;
                state.TrailingLastTrigger += steps * _cfg.TrailingStepGain;
                _repo.Update(userId, state);
                _logger.LogInformation(
                    "Trailing SL raised for userId={UserId}: stop={Stop}, lastTrigger={LastTrigger}",
                    userId, state.TrailingStop, state.TrailingLastTrigger);
            }

            if (mtm <= state.TrailingStop)
            {
                _logger.LogWarning(
                    "Trailing SL hit for userId={UserId} (MTM={Mtm} ≤ stop={Stop}) — exiting all positions",
                    userId, mtm, state.TrailingStop);
                await SquareOffAsync(userId, state, ct);
            }
        }
    }

    private async Task SquareOffAsync(string userId, UserRiskState state, CancellationToken ct)
    {
        try
        {
            await _upstox.ExitAllPositionsAsync(cancellationToken: ct);
            state.IsSquaredOff = true;
            _repo.Update(userId, state);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to exit all positions for userId={UserId}", userId);
        }
    }

    private static string BuildPositionsTable(IReadOnlyList<Position> positions)
    {
        var open = positions.ToList();
        if (open.Count == 0)
            return "  (no positions)";

        const int colSymbol = -28; // left-aligned
        const int colQty    =   6;
        const int colAvg    =   9;
        const int colLtp    =   9;
        const int colPnl    =  11;

        var sb = new StringBuilder();

        // Header
        sb.AppendLine(
            $"  {"Symbol",colSymbol} {"Qty",colQty} {"Avg",colAvg} {"LTP",colLtp} {"P&L",colPnl}");
        sb.AppendLine("  " + new string('─', 28 + 6 + 9 + 9 + 11 + 4));

        foreach (var p in open)
        {
            string pnlStr = p.Pnl >= 0 ? $"+{p.Pnl:F2}" : $"{p.Pnl:F2}";
            sb.AppendLine(
                $"  {p.TradingSymbol,colSymbol} {p.Quantity,colQty} {p.AveragePrice,colAvg:F2} {p.LastPrice,colLtp:F2} {pnlStr,colPnl}");
        }

        sb.Append("  " + new string('─', 28 + 6 + 9 + 9 + 11 + 4));
        decimal totalPnl = open.Sum(p => p.Pnl);
        string totalStr = totalPnl >= 0 ? $"+{totalPnl:F2}" : $"{totalPnl:F2}";
        sb.AppendLine();
        sb.Append($"  {"Total MTM",colSymbol} {"",colQty} {"",colAvg} {"",colLtp} {totalStr,colPnl}");

        return sb.ToString();
    }
}
