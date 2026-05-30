using KAITerminal.Broker;
using KAITerminal.Contracts.Notifications;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Services;

/// <summary>
/// Orchestrates portfolio-level risk evaluation for a single user. Defers
/// MTM aggregation to <see cref="MtmCalculator"/>, status pushes to
/// <see cref="RateLimitedStatusNotifier"/>, and exits to <see cref="PortfolioSquareOff"/>.
/// </summary>
public sealed class RiskEvaluator
{
    private const decimal MtmDriftWarnThreshold = 500m;

    private readonly IRiskRepository           _repo;
    private readonly IRiskEventNotifier        _notifier;
    private readonly IPositionCache            _cache;
    private readonly RateLimitedStatusNotifier _statusNotifier;
    private readonly PortfolioSquareOff        _squareOff;
    private readonly TimeZoneInfo              _tz;
    private readonly ILogger<RiskEvaluator>    _logger;

    public RiskEvaluator(
        IRiskRepository            repo,
        IRiskEventNotifier         notifier,
        IPositionCache             cache,
        RateLimitedStatusNotifier  statusNotifier,
        PortfolioSquareOff         squareOff,
        IOptions<RiskEngineConfig> cfg,
        ILogger<RiskEvaluator>     logger)
    {
        _repo           = repo;
        _notifier       = notifier;
        _cache          = cache;
        _statusNotifier = statusNotifier;
        _squareOff      = squareOff;
        _tz             = TimeZoneInfo.FindSystemTimeZoneById(cfg.Value.TradingTimeZone);
        _logger         = logger;
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
            mtm = MtmCalculator.Compute(positions, _ => null, config.WatchedProducts);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "[EVAL ] Portfolio fetch failed — {UserId} ({Broker})",
                userId, config.BrokerType);
            return;
        }

        await EvaluateAsync(userId, mtm, config, broker, ct);
    }

    /// <summary>Evaluates risk using a pre-computed MTM value and per-user config.</summary>
    public async Task EvaluateAsync(
        string userId, decimal mtm, UserConfig config, IBrokerClient broker, CancellationToken ct = default)
    {
        var stateKey = $"{userId}::{config.BrokerType}";
        var state    = await _repo.ReadAsync(stateKey, s => s.ToSnapshot());

        if (state.IsSquaredOff)
        {
            _logger.LogDebug(
                "[EVAL ] Already squared off — {UserId} ({Broker}) — skipping",
                userId, config.BrokerType);
            return;
        }

        await _statusNotifier.PublishAsync(userId, mtm, state, config, ct);

        var nowIst   = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, _tz).TimeOfDay;
        var decision = RiskDecisionCalculator.Evaluate(mtm, config, state, nowIst);

        if (decision.TrailingUpdate is { } update)
            state = await ApplyTrailingUpdateAsync(stateKey, state, mtm, config, userId, update, ct);

        if (!IsExitDecision(decision.Kind))
            return;

        var exitMtm = await ConfirmExitMtmAsync(stateKey, userId, mtm, config, state, decision.Kind, nowIst, broker, ct);
        if (exitMtm is null) return;

        await ActOnExitAsync(decision.Kind, userId, exitMtm.Value, config, state, stateKey, broker, nowIst, ct);
    }

    private async Task<RiskStateSnapshot> ApplyTrailingUpdateAsync(
        string stateKey, RiskStateSnapshot state, decimal mtm, UserConfig config,
        string userId, TrailingStateUpdate update, CancellationToken ct)
    {
        await _repo.MutateAsync(stateKey, s =>
        {
            s.TrailingActive      = true;
            s.TrailingStop        = update.NewStop;
            s.TrailingLastTrigger = update.NewLastTrigger;
        });

        state = state with
        {
            TrailingActive      = true,
            TrailingStop        = update.NewStop,
            TrailingLastTrigger = update.NewLastTrigger,
        };

        if (update.IsActivation)
        {
            _logger.LogInformation(
                "[TSL  ] Activated — {UserId} ({Broker})  |  floor locked at ₹{Stop:+#,##0;-#,##0}",
                userId, config.BrokerType, state.TrailingStop);
            await _notifier.NotifyAsync(new RiskNotification(
                userId, config.BrokerType, RiskNotificationType.TslActivated,
                mtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
        }
        else
        {
            _logger.LogInformation(
                "[TSL  ] Raised — {UserId} ({Broker})  |  floor → ₹{Stop:+#,##0;-#,##0}",
                userId, config.BrokerType, state.TrailingStop);
            await _notifier.NotifyAsync(new RiskNotification(
                userId, config.BrokerType, RiskNotificationType.TslRaised,
                mtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
        }

        return state;
    }

    /// <summary>
    /// For MTM-driven exits, confirms with a fresh broker fetch before acting — guards
    /// against stale cache (e.g. closed legs disappearing during auto-shift, webhook lag).
    /// Auto square-off is time-driven and skips this check.
    /// </summary>
    private async Task<decimal?> ConfirmExitMtmAsync(
        string stateKey, string userId, decimal cachedMtm, UserConfig config,
        RiskStateSnapshot state, RiskDecisionKind kind, TimeSpan nowIst,
        IBrokerClient broker, CancellationToken ct)
    {
        if (kind == RiskDecisionKind.ExitAutoSquareOff) return cachedMtm;

        var confirmed = await ConfirmMtmAsync(stateKey, userId, config, broker, ct);
        if (confirmed is null)
        {
            _logger.LogWarning(
                "[CONF ] Exit skipped — {Kind} confirmation failed  |  {UserId} ({Broker})  |  cached ₹{CacheMtm:+#,##0;-#,##0}  |  retrying next tick",
                kind, userId, config.BrokerType, cachedMtm);
            return null;
        }

        var drift   = confirmed.Value - cachedMtm;
        var recheck = RiskDecisionCalculator.Evaluate(confirmed.Value, config, state, nowIst);
        if (recheck.Kind != kind)
        {
            _logger.LogWarning(
                "[CONF ] Exit suppressed — {UserId} ({Broker})  |  trigger={Kind}  |  cached ₹{CacheMtm:+#,##0;-#,##0} vs confirmed ₹{ConfirmedMtm:+#,##0;-#,##0} (drift ₹{Drift:+#,##0;-#,##0})  |  cache was stale",
                userId, config.BrokerType, kind, cachedMtm, confirmed.Value, drift);
            return null;
        }

        if (Math.Abs(drift) > MtmDriftWarnThreshold)
            _logger.LogWarning(
                "[CONF ] MTM drift — {UserId} ({Broker})  |  trigger={Kind}  |  cached ₹{CacheMtm:+#,##0;-#,##0} vs confirmed ₹{ConfirmedMtm:+#,##0;-#,##0} (drift ₹{Drift:+#,##0;-#,##0})  |  using confirmed",
                userId, config.BrokerType, kind, cachedMtm, confirmed.Value, drift);

        return confirmed.Value;
    }

    private async Task<decimal?> ConfirmMtmAsync(
        string stateKey, string userId, UserConfig config, IBrokerClient broker, CancellationToken ct)
    {
        try
        {
            var positions  = await broker.GetAllPositionsAsync(ct);
            var breakdown  = MtmCalculator.ComputeWithBreakdown(
                positions,
                token => _cache.TryGetLiveLtp(stateKey, token),
                config.WatchedProducts);

            foreach (var line in breakdown.Lines)
                _logger.LogDebug(
                    "[CONF ] {Token} qty={Qty}  |  {Note}  →  ₹{Contribution:+#,##0;-#,##0}  [{UserId}]",
                    line.InstrumentToken, line.Quantity, line.Note, line.Contribution, userId);

            _logger.LogInformation(
                "[CONF ] MTM confirmed — {UserId} ({Broker})  |  {OpenCount} open + {ClosedCount} closed  |  ₹{Total:+#,##0;-#,##0}",
                userId, config.BrokerType, breakdown.OpenCount, breakdown.ClosedCount, breakdown.Total);

            return breakdown.Total;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "[CONF ] MTM fetch failed — {UserId} ({Broker}) — broker unavailable",
                userId, config.BrokerType);
            return null;
        }
    }

    private async Task ActOnExitAsync(
        RiskDecisionKind kind, string userId, decimal exitMtm, UserConfig config,
        RiskStateSnapshot state, string stateKey, IBrokerClient broker, TimeSpan nowIst,
        CancellationToken ct)
    {
        switch (kind)
        {
            case RiskDecisionKind.ExitMtmSl:
                _logger.LogWarning(
                    "[SL   ] Hard SL hit — {UserId} ({Broker})  |  P&L ₹{Mtm:+#,##0;-#,##0}  ≤  SL ₹{Sl:+#,##0;-#,##0} — exiting all",
                    userId, config.BrokerType, exitMtm, config.MtmSl);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.HardSlHit,
                    exitMtm, Sl: config.MtmSl, Timestamp: DateTimeOffset.UtcNow), ct);
                break;

            case RiskDecisionKind.ExitTarget:
                _logger.LogInformation(
                    "[TGT  ] Target hit — {UserId} ({Broker})  |  P&L ₹{Mtm:+#,##0;-#,##0}  ≥  Target ₹{Target:+#,##0} — exiting all",
                    userId, config.BrokerType, exitMtm, config.MtmTarget);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TargetHit,
                    exitMtm, Target: config.MtmTarget, Timestamp: DateTimeOffset.UtcNow), ct);
                break;

            case RiskDecisionKind.ExitAutoSquareOff:
                _logger.LogWarning(
                    "[ASO  ] Auto square-off — {UserId} ({Broker})  |  {Now} ≥ {Cfg} — exiting all",
                    userId, config.BrokerType,
                    nowIst.ToString(@"hh\:mm"), config.AutoSquareOffTime.ToString(@"hh\:mm"));
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.AutoSquareOff,
                    exitMtm, Timestamp: DateTimeOffset.UtcNow), ct);
                break;

            case RiskDecisionKind.ExitTrailingSl:
                _logger.LogWarning(
                    "[TSL  ] Hit — {UserId} ({Broker})  |  P&L ₹{Mtm:+#,##0;-#,##0}  ≤  floor ₹{Stop:+#,##0;-#,##0} — exiting all",
                    userId, config.BrokerType, exitMtm, state.TrailingStop);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TslHit,
                    exitMtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
                break;

            default:
                return;
        }

        await _squareOff.ExecuteAsync(userId, config.BrokerType, stateKey, exitMtm, broker, config, ct);
    }

    private static bool IsExitDecision(RiskDecisionKind kind) =>
        kind is RiskDecisionKind.ExitMtmSl
             or RiskDecisionKind.ExitTarget
             or RiskDecisionKind.ExitAutoSquareOff
             or RiskDecisionKind.ExitTrailingSl;
}
