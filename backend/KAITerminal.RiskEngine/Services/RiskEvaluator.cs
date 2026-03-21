using KAITerminal.Broker;
using KAITerminal.Contracts.Notifications;
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
    private readonly IRiskRepository     _repo;
    private readonly IRiskEventNotifier  _notifier;
    private readonly RiskEngineConfig    _cfg;
    private readonly ILogger<RiskEvaluator> _logger;

    public RiskEvaluator(
        IRiskRepository repo,
        IRiskEventNotifier notifier,
        IOptions<RiskEngineConfig> cfg,
        ILogger<RiskEvaluator> logger)
    {
        _repo     = repo;
        _notifier = notifier;
        _cfg      = cfg.Value;
        _logger   = logger;
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
            _logger.LogWarning(ex,
                "Portfolio fetch failed — {UserId} ({Broker})",
                userId, config.BrokerType);
            return;
        }

        await EvaluateAsync(userId, mtm, config, broker, ct);
    }

    /// <summary>Evaluates risk using a pre-computed MTM value and per-user config.</summary>
    public async Task EvaluateAsync(
        string userId, decimal mtm, UserConfig config, IBrokerClient broker, CancellationToken ct = default)
    {
        var state = await _repo.GetOrCreateAsync(userId);

        if (state.IsSquaredOff)
        {
            _logger.LogDebug(
                "Skipping — {UserId} ({Broker}) is already squared off",
                userId, config.BrokerType);
            return;
        }

        LogStatus(userId, mtm, state, config);

        // ── 1. Hard stop loss ────────────────────────────────────────────────
        if (mtm <= config.MtmSl)
        {
            _logger.LogWarning(
                "HARD SL HIT — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  ≤  SL ₹{Sl:+#,##0;-#,##0} — exiting all",
                userId, config.BrokerType, mtm, config.MtmSl);
            await _notifier.NotifyAsync(new RiskNotification(
                userId, config.BrokerType, RiskNotificationType.HardSlHit,
                mtm, Sl: config.MtmSl, Timestamp: DateTimeOffset.UtcNow), ct);
            await SquareOffAsync(userId, config.BrokerType, mtm, state, broker, ct);
            return;
        }

        // ── 2. Profit target ─────────────────────────────────────────────────
        if (mtm >= config.MtmTarget)
        {
            _logger.LogInformation(
                "TARGET HIT — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  ≥  Target ₹{Target:+#,##0} — exiting all",
                userId, config.BrokerType, mtm, config.MtmTarget);
            await _notifier.NotifyAsync(new RiskNotification(
                userId, config.BrokerType, RiskNotificationType.TargetHit,
                mtm, Target: config.MtmTarget, Timestamp: DateTimeOffset.UtcNow), ct);
            await SquareOffAsync(userId, config.BrokerType, mtm, state, broker, ct);
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
                await _repo.UpdateAsync(userId, state);
                _logger.LogInformation(
                    "TSL ACTIVATED — {UserId} ({Broker})  floor locked at ₹{Stop:+#,##0;-#,##0}",
                    userId, config.BrokerType, state.TrailingStop);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TslActivated,
                    mtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
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
                await _repo.UpdateAsync(userId, state);
                _logger.LogInformation(
                    "TSL RAISED — {UserId} ({Broker})  floor → ₹{Stop:+#,##0;-#,##0}",
                    userId, config.BrokerType, state.TrailingStop);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TslRaised,
                    mtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
            }

            if (mtm <= state.TrailingStop)
            {
                _logger.LogWarning(
                    "TSL HIT — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  ≤  floor ₹{Stop:+#,##0;-#,##0} — exiting all",
                    userId, config.BrokerType, mtm, state.TrailingStop);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TslHit,
                    mtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
                await SquareOffAsync(userId, config.BrokerType, mtm, state, broker, ct);
            }
        }
    }

    private void LogStatus(string userId, decimal mtm, UserRiskState state, UserConfig config)
    {
        if (state.TrailingActive)
        {
            _logger.LogInformation(
                "{UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL ₹{Stop:+#,##0;-#,##0}",
                userId, config.BrokerType, mtm, config.MtmTarget, state.TrailingStop);
        }
        else
        {
            _logger.LogInformation(
                "{UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  |  SL ₹{Sl:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL off — activates at ₹{Threshold:+#,##0}",
                userId, config.BrokerType, mtm, config.MtmSl, config.MtmTarget, config.TrailingActivateAt);
        }
    }

    private async Task SquareOffAsync(
        string userId, string brokerType, decimal mtm, UserRiskState state, IBrokerClient broker, CancellationToken ct)
    {
        try
        {
            await broker.ExitAllPositionsAsync(ct: ct);
            state.IsSquaredOff = true;
            await _repo.UpdateAsync(userId, state);
            _logger.LogWarning(
                "Square-off complete — {UserId} ({Broker}) — all positions exited",
                userId, brokerType);
            await _notifier.NotifyAsync(new RiskNotification(
                userId, brokerType, RiskNotificationType.SquareOffComplete,
                mtm, Timestamp: DateTimeOffset.UtcNow), ct);
        }
        catch (Exception ex)
        {
            state.IsSquaredOff = true;
            await _repo.UpdateAsync(userId, state);
            _logger.LogError(ex,
                "Square-off FAILED — {UserId} ({Broker}) — marked as squared-off; manual verification required",
                userId, brokerType);
            await _notifier.NotifyAsync(new RiskNotification(
                userId, brokerType, RiskNotificationType.SquareOffFailed,
                mtm, Timestamp: DateTimeOffset.UtcNow), ct);
        }
    }
}
