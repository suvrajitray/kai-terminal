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
    private readonly RiskEngineConfig       _cfg;
    private readonly TimeZoneInfo           _tz;
    private readonly ILogger<RiskEvaluator> _logger;
    private readonly ConcurrentDictionary<string, DateTimeOffset> _lastStatusPushed = new();

    public RiskEvaluator(
        IRiskRepository        repo,
        IRiskEventNotifier     notifier,
        IOptions<RiskEngineConfig> cfg,
        ILogger<RiskEvaluator> logger)
    {
        _repo     = repo;
        _notifier = notifier;
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

        // Act on the exit decision
        switch (decision.Kind)
        {
            case RiskDecisionKind.ExitMtmSl:
                _logger.LogWarning(
                    "HARD SL HIT — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  ≤  SL ₹{Sl:+#,##0;-#,##0} — exiting all",
                    userId, config.BrokerType, mtm, config.MtmSl);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.HardSlHit,
                    mtm, Sl: config.MtmSl, Timestamp: DateTimeOffset.UtcNow), ct);
                await SquareOffAsync(userId, config.BrokerType, stateKey, mtm, state, broker, config, ct);
                break;

            case RiskDecisionKind.ExitTarget:
                _logger.LogInformation(
                    "TARGET HIT — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  ≥  Target ₹{Target:+#,##0} — exiting all",
                    userId, config.BrokerType, mtm, config.MtmTarget);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TargetHit,
                    mtm, Target: config.MtmTarget, Timestamp: DateTimeOffset.UtcNow), ct);
                await SquareOffAsync(userId, config.BrokerType, stateKey, mtm, state, broker, config, ct);
                break;

            case RiskDecisionKind.ExitAutoSquareOff:
                _logger.LogWarning(
                    "AUTO SQUARE-OFF — {UserId} ({Broker})  time {Now} ≥ configured {Cfg} — exiting all",
                    userId, config.BrokerType,
                    nowIst.ToString(@"HH\:mm"), config.AutoSquareOffTime.ToString(@"HH\:mm"));
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.AutoSquareOff,
                    mtm, Timestamp: DateTimeOffset.UtcNow), ct);
                await SquareOffAsync(userId, config.BrokerType, stateKey, mtm, state, broker, config, ct);
                break;

            case RiskDecisionKind.ExitTrailingSl:
                _logger.LogWarning(
                    "TSL HIT — {UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  ≤  floor ₹{Stop:+#,##0;-#,##0} — exiting all",
                    userId, config.BrokerType, mtm, state.TrailingStop);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, config.BrokerType, RiskNotificationType.TslHit,
                    mtm, TslFloor: state.TrailingStop, Timestamp: DateTimeOffset.UtcNow), ct);
                await SquareOffAsync(userId, config.BrokerType, stateKey, mtm, state, broker, config, ct);
                break;
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
            _logger.LogInformation(
                "{UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL ₹{Stop:+#,##0;-#,##0}  [{Watch}]",
                userId, config.BrokerType, mtm, config.MtmTarget, state.TrailingStop, watch);
        }
        else
        {
            _logger.LogInformation(
                "{UserId} ({Broker})  PnL ₹{Mtm:+#,##0;-#,##0}  |  SL ₹{Sl:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL off — activates at ₹{Threshold:+#,##0}  [{Watch}]",
                userId, config.BrokerType, mtm, config.MtmSl, config.MtmTarget, config.TrailingActivateAt, watch);
        }

        // Rate-limited StatusUpdate push to frontend (at most once per 15 min per broker)
        var key = $"{userId}::{config.BrokerType}";
        var now = DateTimeOffset.UtcNow;
        if ((now - _lastStatusPushed.GetValueOrDefault(key, DateTimeOffset.MinValue)).TotalMinutes >= 15)
        {
            _lastStatusPushed[key] = now;
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

            if (toExit.Count == 0)
            {
                _logger.LogWarning(
                    "Square-off — {UserId} ({Broker}) filter={Filter} — no open positions found (already closed?)",
                    userId, brokerType, config.WatchedProducts);
            }
            else
            {
                _logger.LogWarning(
                    "Square-off — {UserId} ({Broker}) filter={Filter} — {Count} position(s) to exit (sells first)",
                    userId, brokerType, config.WatchedProducts, toExit.Count);
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
