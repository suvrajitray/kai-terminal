using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Models;
using KAITerminal.Upstox;
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

        decimal mtm;
        try
        {
            mtm = await _upstox.GetTotalMtmAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Portfolio check: failed to fetch MTM for userId={UserId}", userId);
            return;
        }

        LogStatus(userId, mtm, state);

        // ── 1. Hard stop loss ────────────────────────────────────────────────
        if (mtm <= _cfg.HardStopLoss)
        {
            _logger.LogWarning("Hard SL hit for userId={UserId} — exiting all positions", userId);
            await SquareOffAsync(userId, state, ct);
            return;
        }

        // ── 2. Profit target ─────────────────────────────────────────────────
        if (mtm >= _cfg.ProfitTarget)
        {
            _logger.LogInformation("Target hit for userId={UserId} — exiting all positions", userId);
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
                    "Trailing SL activated for userId={UserId}  stop={Stop:+0;-0}  locked-in={Lock:+0;-0}",
                    userId, state.TrailingStop, _cfg.TrailingInitialLock);
            }
        }
        else
        {
            decimal gain = mtm - state.TrailingLastTrigger;
            if (gain >= _cfg.TrailingStepGain)
            {
                long steps = (long)(gain / _cfg.TrailingStepGain);
                state.TrailingStop += steps * _cfg.TrailingStepLock;
                state.TrailingLastTrigger += steps * _cfg.TrailingStepGain;
                _repo.Update(userId, state);
                _logger.LogInformation(
                    "Trailing SL raised for userId={UserId}  stop={Stop:+0;-0}",
                    userId, state.TrailingStop);
            }

            if (mtm <= state.TrailingStop)
            {
                _logger.LogWarning(
                    "Trailing SL hit for userId={UserId}  MTM={Mtm:+0;-0}  stop={Stop:+0;-0} — exiting all positions",
                    userId, mtm, state.TrailingStop);
                await SquareOffAsync(userId, state, ct);
            }
        }
    }

    private void LogStatus(string userId, decimal mtm, UserRiskState state)
    {
        if (state.TrailingActive)
        {
            _logger.LogInformation(
                "[{UserId}]  PnL={Mtm:+0;-0}  Target={Target:+0}  TSL={Stop:+0;-0}",
                userId, mtm, _cfg.ProfitTarget, state.TrailingStop);
        }
        else
        {
            _logger.LogInformation(
                "[{UserId}]  PnL={Mtm:+0;-0}  SL={Sl:0}  Target={Target:+0}  TSL=inactive (activates at {Threshold:+0})",
                userId, mtm, _cfg.HardStopLoss, _cfg.ProfitTarget, _cfg.TrailingActivationThreshold);
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
}
