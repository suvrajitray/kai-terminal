using KAITerminal.Broker;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Services;

/// <summary>
/// Evaluates portfolio-level risk for a single user.
/// Call <see cref="EvaluateAsync(string,decimal,UserConfig,IBrokerClient,CancellationToken)"/>
/// with a pre-computed MTM from the position cache, or the REST-fetching overload for
/// out-of-band checks.
/// </summary>
public sealed class RiskEvaluator
{
    private readonly IRiskRepository _repo;
    private readonly RiskEngineConfig _cfg;
    private readonly ILogger<RiskEvaluator> _logger;

    public RiskEvaluator(
        IRiskRepository repo,
        IOptions<RiskEngineConfig> cfg,
        ILogger<RiskEvaluator> logger)
    {
        _repo   = repo;
        _cfg    = cfg.Value;
        _logger = logger;
    }

    /// <summary>
    /// Fetches positions via REST, computes MTM, then evaluates risk.
    /// Call inside an appropriate token context scope.
    /// </summary>
    public async Task EvaluateAsync(
        string userId, UserConfig config, IBrokerClient broker, CancellationToken ct = default)
    {
        decimal mtm;
        try
        {
            var positions = await broker.GetAllPositionsAsync(ct);
            mtm = _cfg.FilterPositions(positions).Sum(p => p.Pnl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Portfolio check: failed to fetch MTM for userId={UserId}", userId);
            return;
        }

        await EvaluateAsync(userId, mtm, config, broker, ct);
    }

    /// <summary>Evaluates risk using a pre-computed MTM value and per-user config.</summary>
    public async Task EvaluateAsync(
        string userId, decimal mtm, UserConfig config, IBrokerClient broker, CancellationToken ct = default)
    {
        var state = _repo.GetOrCreate(userId);

        if (state.IsSquaredOff)
        {
            _logger.LogDebug("Portfolio check skipped for userId={UserId}: already squared off", userId);
            return;
        }

        LogStatus(userId, mtm, state, config);

        // ── 1. Hard stop loss ────────────────────────────────────────────────
        if (mtm <= config.MtmSl)
        {
            _logger.LogWarning(
                "Hard SL hit for userId={UserId}  MTM={Mtm:+0;-0}  SL={Sl:+0;-0} — exiting all positions",
                userId, mtm, config.MtmSl);
            await SquareOffAsync(userId, state, broker, ct);
            return;
        }

        // ── 2. Profit target ─────────────────────────────────────────────────
        if (mtm >= config.MtmTarget)
        {
            _logger.LogInformation(
                "Target hit for userId={UserId}  MTM={Mtm:+0;-0}  Target={Target:+0} — exiting all positions",
                userId, mtm, config.MtmTarget);
            await SquareOffAsync(userId, state, broker, ct);
            return;
        }

        // ── 3. Trailing stop loss ────────────────────────────────────────────
        if (!config.TrailingEnabled) return;

        if (!state.TrailingActive)
        {
            if (mtm >= config.TrailingActivateAt)
            {
                state.TrailingActive      = true;
                state.TrailingStop        = config.LockProfitAt;
                state.TrailingLastTrigger = mtm;
                _repo.Update(userId, state);
                _logger.LogInformation(
                    "Trailing SL activated for userId={UserId}  stop locked at={Stop:+0;-0}",
                    userId, state.TrailingStop);
            }
        }
        else
        {
            decimal gain = mtm - state.TrailingLastTrigger;
            if (gain >= config.WhenProfitIncreasesBy)
            {
                long steps = (long)(gain / config.WhenProfitIncreasesBy);
                state.TrailingStop        += steps * config.IncreaseTrailingBy;
                state.TrailingLastTrigger += steps * config.WhenProfitIncreasesBy;
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
                await SquareOffAsync(userId, state, broker, ct);
            }
        }
    }

    private void LogStatus(string userId, decimal mtm, UserRiskState state, UserConfig config)
    {
        if (state.TrailingActive)
        {
            _logger.LogInformation(
                "[{UserId}]  PnL={Mtm:+0;-0}  Target={Target:+0}  TSL={Stop:+0;-0}",
                userId, mtm, config.MtmTarget, state.TrailingStop);
        }
        else
        {
            _logger.LogInformation(
                "[{UserId}]  PnL={Mtm:+0;-0}  SL={Sl:0}  Target={Target:+0}  TSL=inactive (activates at {Threshold:+0})",
                userId, mtm, config.MtmSl, config.MtmTarget, config.TrailingActivateAt);
        }
    }

    private async Task SquareOffAsync(
        string userId, UserRiskState state, IBrokerClient broker, CancellationToken ct)
    {
        try
        {
            await broker.ExitAllPositionsAsync(ct: ct);
            state.IsSquaredOff = true;
            _repo.Update(userId, state);
            _logger.LogWarning("Square-off complete for userId={UserId} — all positions exited", userId);
        }
        catch (Exception ex)
        {
            state.IsSquaredOff = true;
            _repo.Update(userId, state);
            _logger.LogError(ex,
                "Failed to exit all positions for userId={UserId} — marked as squared-off to prevent retry loops; manual verification required",
                userId);
        }
    }
}
