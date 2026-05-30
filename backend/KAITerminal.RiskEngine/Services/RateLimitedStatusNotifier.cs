using System.Collections.Concurrent;
using KAITerminal.Contracts.Notifications;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using Microsoft.Extensions.Logging;

namespace KAITerminal.RiskEngine.Services;

/// <summary>
/// Emits per-user status logs every tick at Debug level, plus one Information-level
/// log and one <see cref="RiskNotificationType.StatusUpdate"/> notification at most
/// every <see cref="PushIntervalMinutes"/> per user/broker pair.
/// </summary>
public sealed class RateLimitedStatusNotifier
{
    public const int PushIntervalMinutes = 15;

    private readonly IRiskEventNotifier                                _notifier;
    private readonly ILogger<RateLimitedStatusNotifier>                _logger;
    private readonly ConcurrentDictionary<string, DateTimeOffset>      _lastPushed = new();

    public RateLimitedStatusNotifier(
        IRiskEventNotifier                _notifier,
        ILogger<RateLimitedStatusNotifier> _logger)
    {
        this._notifier = _notifier;
        this._logger   = _logger;
    }

    public async Task PublishAsync(
        string userId, decimal mtm, RiskStateSnapshot state, UserConfig config, CancellationToken ct)
    {
        var watch = WatchLabel(config.WatchedProducts);

        if (state.TrailingActive)
        {
            _logger.LogDebug(
                "[STAT ] {UserId} ({Broker})  P&L ₹{Mtm:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL ₹{Stop:+#,##0;-#,##0}  [{Watch}]",
                userId, config.BrokerType, mtm, config.MtmTarget, state.TrailingStop, watch);
        }
        else
        {
            _logger.LogDebug(
                "[STAT ] {UserId} ({Broker})  P&L ₹{Mtm:+#,##0;-#,##0}  |  SL ₹{Sl:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL activates at ₹{Threshold:+#,##0}  [{Watch}]",
                userId, config.BrokerType, mtm, config.MtmSl, config.MtmTarget, config.TrailingActivateAt, watch);
        }

        var key = $"{userId}::{config.BrokerType}";
        var now = DateTimeOffset.UtcNow;
        if (!TryClaim(key, now)) return;

        _logger.LogInformation(
            "[STAT ] {UserId} ({Broker})  P&L ₹{Mtm:+#,##0;-#,##0}  |  SL ₹{Sl:+#,##0;-#,##0}  |  Target ₹{Target:+#,##0}  |  TSL {TslState}  [{Watch}]",
            userId, config.BrokerType, mtm, config.MtmSl, config.MtmTarget,
            state.TrailingActive ? $"₹{state.TrailingStop:+#,##0;-#,##0}" : "off",
            watch);

        await _notifier.NotifyAsync(new RiskNotification(
            userId, config.BrokerType, RiskNotificationType.StatusUpdate,
            mtm, Sl: config.MtmSl, Target: config.MtmTarget,
            TslFloor: state.TrailingActive ? state.TrailingStop : null,
            Timestamp: now), ct);
    }

    private bool TryClaim(string key, DateTimeOffset now)
    {
        if ((now - _lastPushed.GetValueOrDefault(key, DateTimeOffset.MinValue)).TotalMinutes < PushIntervalMinutes)
            return false;
        _lastPushed[key] = now;
        return true;
    }

    private static string WatchLabel(string watchedProducts) => watchedProducts switch
    {
        "Intraday" => "Intraday",
        "Delivery" => "Delivery",
        _          => "Intraday + Delivery",
    };
}
