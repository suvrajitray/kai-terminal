using System.Collections.Concurrent;
using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
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
    private readonly IRiskRepository        _repo;
    private readonly IRiskEventNotifier     _notifier;
    private readonly IPositionCache         _cache;
    private readonly RiskEngineConfig       _cfg;
    private readonly TimeZoneInfo           _tz;
    private readonly ILogger<RiskEvaluator> _logger;
    private readonly ConcurrentDictionary<string, DateTimeOffset> _lastStatusPushed = new();

    public RiskEvaluator(
        IRiskRepository        repo,
        IRiskEventNotifier     notifier,
        IPositionCache         cache,
        IOptions<RiskEngineConfig> cfg,
        ILogger<RiskEvaluator> logger)
    {
        _repo     = repo;
        _notifier = notifier;
        _cache    = cache;
        _cfg      = cfg.Value;
        _tz       = TimeZoneInfo.FindSystemTimeZoneById(_cfg.TradingTimeZone);
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
            mtm = positions
                .Where(p => ProductTypeFilter.Matches(p.Product, config.WatchedProducts))
                .Sum(p => p.Pnl);
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
        var stateKey = $"{userId}::{config.BrokerType}";
        var state = await _repo.ReadAsync(stateKey, s => s.ToSnapshot());

        if (state.IsSquaredOff)
        {
            _logger.LogDebug(
                "Skipping — {UserId} ({Broker}) is already squared off",
                userId, config.BrokerType);
            return;
        }

        await LogStatusAsync(userId, mtm, state, config, ct);

        var nowIst = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, _tz).TimeOfDay;
        var decision = RiskDecisionCalculator.Evaluate(mtm, config, state, nowIst);

        if (decision.TrailingUpdate is { } update)
        {
            await _repo.MutateAsync(stateKey, s =>
            {
                s.TrailingActive      = true;
                s.TrailingStop        = update.NewStop;
                s.TrailingLastTrigger = update.NewLastTrigger;
            });

            state = state with
            {
                TrailingActive = true,
                TrailingStop = update.NewStop,
                TrailingLastTrigger = update.NewLastTrigger,
            };

            if (update.IsActivation)
            {
                _logger.LogInformation(
                    "TSL ACTIVATED — {UserId} ({Broker})  floor locked at ₹{Stop:+#,##0;-#,##0}",
                    userId, config.BrokerType, state.TrailingStop);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TslActivated,
                    mtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
            }
            else
            {
                _logger.LogInformation(
                    "TSL RAISED — {UserId} ({Broker})  floor → ₹{Stop:+#,##0;-#,##0}",
                    userId, config.BrokerType, state.TrailingStop);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TslRaised,
                    mtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
            }
        }

        // For MTM-driven exits, confirm with a fresh broker fetch before acting.
        // This guards against stale cache (e.g. closed legs disappearing from the list
        // during auto-shift, webhook lag, or any other transient position state).
        // Auto square-off is time-driven — no MTM confirmation needed there.
        decimal exitMtm = mtm;
        if (decision.Kind is RiskDecisionKind.ExitMtmSl
                          or RiskDecisionKind.ExitTarget
                          or RiskDecisionKind.ExitTrailingSl)
        {
            var confirmed = await ConfirmMtmAsync(stateKey, userId, config, broker, ct);
            if (confirmed is null)
            {
                _logger.LogWarning(
                    "Exit skipped — broker MTM confirmation failed while checking {Kind} for {UserId} ({Broker}) | cachedMtm ₹{CacheMtm:+#,##0;-#,##0} | will retry next tick",
                    decision.Kind, userId, config.BrokerType, mtm);
                return;
            }

            var drift = confirmed.Value - mtm;
            var recheck = RiskDecisionCalculator.Evaluate(confirmed.Value, config, state, nowIst);
            if (recheck.Kind != decision.Kind)
            {
                _logger.LogWarning(
                    "EXIT SUPPRESSED — {UserId} ({Broker}) | trigger={Kind} | cachedMtm ₹{CacheMtm:+#,##0;-#,##0} vs confirmedMtm ₹{ConfirmedMtm:+#,##0;-#,##0} (drift ₹{Drift:+#,##0;-#,##0}) | cache was stale — exit cancelled",
                    userId, config.BrokerType, decision.Kind, mtm, confirmed.Value, drift);
                return;
            }

            if (Math.Abs(drift) > 500)
            {
                _logger.LogWarning(
                    "MTM drift detected — {UserId} ({Broker}) | trigger={Kind} | cachedMtm ₹{CacheMtm:+#,##0;-#,##0} vs confirmedMtm ₹{ConfirmedMtm:+#,##0;-#,##0} (drift ₹{Drift:+#,##0;-#,##0}) | proceeding with confirmed value",
                    userId, config.BrokerType, decision.Kind, mtm, confirmed.Value, drift);
            }

            exitMtm = confirmed.Value;
        }

        // Act on the exit decision
        switch (decision.Kind)
        {
            case RiskDecisionKind.ExitMtmSl:
                _logger.LogWarning(
                    "HARD SL HIT — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  ≤  SL ₹{Sl:+#,##0;-#,##0} — exiting all",
                    userId, config.BrokerType, exitMtm, config.MtmSl);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.HardSlHit,
                    exitMtm, Sl: config.MtmSl, Timestamp: DateTimeOffset.UtcNow), ct);
                await SquareOffAsync(userId, config.BrokerType, stateKey, exitMtm, state, broker, config, ct);
                break;

            case RiskDecisionKind.ExitTarget:
                _logger.LogInformation(
                    "TARGET HIT — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  ≥  Target ₹{Target:+#,##0} — exiting all",
                    userId, config.BrokerType, exitMtm, config.MtmTarget);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TargetHit,
                    exitMtm, Target: config.MtmTarget, Timestamp: DateTimeOffset.UtcNow), ct);
                await SquareOffAsync(userId, config.BrokerType, stateKey, exitMtm, state, broker, config, ct);
                break;

            case RiskDecisionKind.ExitAutoSquareOff:
                _logger.LogWarning(
                    "AUTO SQUARE-OFF — {UserId} ({Broker})  time {Now} ≥ configured {Cfg} — exiting all",
                    userId, config.BrokerType,
                    nowIst.ToString(@"HH\:mm"), config.AutoSquareOffTime.ToString(@"HH\:mm"));
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.AutoSquareOff,
                    exitMtm, Timestamp: DateTimeOffset.UtcNow), ct);
                await SquareOffAsync(userId, config.BrokerType, stateKey, exitMtm, state, broker, config, ct);
                break;

            case RiskDecisionKind.ExitTrailingSl:
                _logger.LogWarning(
                    "TSL HIT — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  ≤  floor ₹{Stop:+#,##0;-#,##0} — exiting all",
                    userId, config.BrokerType, exitMtm, state.TrailingStop);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TslHit,
                    exitMtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
                await SquareOffAsync(userId, config.BrokerType, stateKey, exitMtm, state, broker, config, ct);
                break;
        }
    }

    /// <summary>
    /// Fetches fresh positions from the broker and computes a confirmed MTM:
    /// closed positions (qty=0) contribute their broker-reported realized P&amp;L;
    /// open positions use the broker P&amp;L adjusted by the live LTP delta from the feed cache.
    /// Returns null if the broker fetch fails (caller should skip the exit for this tick).
    /// </summary>
    private async Task<decimal?> ConfirmMtmAsync(
        string stateKey, string userId, UserConfig config, IBrokerClient broker, CancellationToken ct)
    {
        try
        {
            var positions = await broker.GetAllPositionsAsync(ct);
            decimal total = 0m;
            int openCount = 0, closedCount = 0;

            foreach (var p in positions)
            {
                if (!ProductTypeFilter.Matches(p.Product, config.WatchedProducts)) continue;

                decimal contribution;
                string ltpNote;

                if (!p.IsOpen)
                {
                    contribution = p.Pnl;
                    ltpNote      = "closed — realized pnl";
                    closedCount++;
                }
                else
                {
                    var liveLtp = _cache.TryGetLiveLtp(stateKey, p.InstrumentToken);
                    if (liveLtp.HasValue)
                    {
                        var adj  = p.Quantity * (liveLtp.Value - p.Ltp);
                        contribution = p.Pnl + adj;
                        ltpNote = $"open — brokerPnl ₹{p.Pnl:+#,##0;-#,##0} + liveAdj ₹{adj:+#,##0;-#,##0} (ltp={liveLtp.Value} ref={p.Ltp})";
                    }
                    else
                    {
                        contribution = p.Pnl;
                        ltpNote = "open — no live LTP, using broker pnl";
                    }
                    openCount++;
                }

                total += contribution;
                _logger.LogDebug(
                    "  MTM confirm [{UserId}] {Token} qty={Qty}: {LtpNote} → ₹{Contribution:+#,##0;-#,##0}",
                    userId, p.InstrumentToken, p.Quantity, ltpNote, contribution);
            }

            _logger.LogInformation(
                "MTM confirmed — {UserId} ({Broker}) | {OpenCount} open + {ClosedCount} closed position(s) | confirmedMtm ₹{Total:+#,##0;-#,##0}",
                userId, config.BrokerType, openCount, closedCount, total);

            return total;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "MTM confirmation fetch failed — {UserId} ({Broker}) — broker positions unavailable",
                userId, config.BrokerType);
            return null;
        }
    }

    private async Task LogStatusAsync(
        string userId, decimal mtm, RiskStateSnapshot state, UserConfig config, CancellationToken ct)
    {
        var watch = config.WatchedProducts switch
        {
            "Intraday" => "Intraday",
            "Delivery" => "Delivery",
            _          => "Intraday + Delivery",
        };
        if (state.TrailingActive)
        {
            _logger.LogDebug(
                "{UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL ₹{Stop:+#,##0;-#,##0}  [{Watch}]",
                userId, config.BrokerType, mtm, config.MtmTarget, state.TrailingStop, watch);
        }
        else
        {
            _logger.LogDebug(
                "{UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  |  SL ₹{Sl:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL off — activates at ₹{Threshold:+#,##0}  [{Watch}]",
                userId, config.BrokerType, mtm, config.MtmSl, config.MtmTarget, config.TrailingActivateAt, watch);
        }

        // Rate-limited StatusUpdate push to frontend (at most once per 15 min per broker)
        var key = $"{userId}::{config.BrokerType}";
        var now = DateTimeOffset.UtcNow;
        if ((now - _lastStatusPushed.GetValueOrDefault(key, DateTimeOffset.MinValue)).TotalMinutes >= 15)
        {
            _lastStatusPushed[key] = now;
            _logger.LogInformation(
                "Status update — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  |  SL ₹{Sl:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL {TslState}  [{Watch}]",
                userId, config.BrokerType, mtm, config.MtmSl, config.MtmTarget,
                state.TrailingActive ? $"₹{state.TrailingStop:+#,##0;-#,##0}" : "off",
                watch);
            await _notifier.NotifyAsync(new RiskNotification(
                userId, config.BrokerType, RiskNotificationType.StatusUpdate,
                mtm, Sl: config.MtmSl, Target: config.MtmTarget,
                TslFloor: state.TrailingActive ? state.TrailingStop : null,
                Timestamp: now), ct);
        }
    }

    private async Task SquareOffAsync(
        string userId, string brokerType, string stateKey, decimal mtm,
        RiskStateSnapshot state, IBrokerClient broker, UserConfig config, CancellationToken ct)
    {
        try
        {
            // Fetch fresh positions (avoids stale cache if user manually closed some),
            // filter to WatchedProducts, then exit sells before buys to avoid margin spikes.
            var fresh = await broker.GetAllPositionsAsync(ct);
            var toExit = fresh
                .Where(p => p.IsOpen && ProductTypeFilter.Matches(p.Product, config.WatchedProducts))
                .OrderBy(p => p.Quantity < 0 ? 0 : 1)   // sells first → releases margin
                .ToList();
            var excluded = fresh.Count(p => p.IsOpen && !ProductTypeFilter.Matches(p.Product, config.WatchedProducts));

            if (toExit.Count == 0)
            {
                _logger.LogWarning(
                    "Square-off — {UserId} ({Broker}) filter={Filter} — no open positions found (already closed?) | total={Total} excluded={Excluded}",
                    userId, brokerType, config.WatchedProducts, fresh.Count, excluded);
            }
            else
            {
                _logger.LogWarning(
                    "Square-off — {UserId} ({Broker}) filter={Filter} — {Count} position(s) to exit (sells first) | total={Total} excluded={Excluded}",
                    userId, brokerType, config.WatchedProducts, toExit.Count, fresh.Count, excluded);
            }

            foreach (var pos in toExit)
            {
                _logger.LogInformation(
                    "  Exiting {Direction} {Token} qty={Qty} product={Product} [{Broker} / {UserId}]",
                    pos.Quantity < 0 ? "SHORT" : "LONG", pos.InstrumentToken, Math.Abs(pos.Quantity), pos.Product, brokerType, userId);
                await broker.ExitPositionAsync(pos.InstrumentToken, pos.Product, ct);
            }

            await _repo.MutateAsync(stateKey, s => s.IsSquaredOff = true);
            state = state with { IsSquaredOff = true };

            if (toExit.Count > 0)
            {
                _logger.LogWarning(
                    "Square-off complete — {UserId} ({Broker}) — {Count} position(s) exited [{Filter}]",
                    userId, brokerType, toExit.Count, config.WatchedProducts);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, brokerType, RiskNotificationType.SquareOffComplete,
                    mtm, Timestamp: DateTimeOffset.UtcNow), ct);
            }
            else
            {
                _logger.LogWarning(
                    "Square-off skipped — {UserId} ({Broker}) — no open [{Filter}] positions found; already closed manually",
                    userId, brokerType, config.WatchedProducts);
            }
        }
        catch (Exception ex)
        {
            await _repo.MutateAsync(stateKey, s => s.IsSquaredOff = true);
            state = state with { IsSquaredOff = true };
            _logger.LogError(ex,
                "Square-off FAILED — {UserId} ({Broker}) — marked as squared-off; manual verification required",
                userId, brokerType);
            await _notifier.NotifyAsync(new RiskNotification(
                userId, brokerType, RiskNotificationType.SquareOffFailed,
                mtm, Timestamp: DateTimeOffset.UtcNow), ct);
        }
    }
}
