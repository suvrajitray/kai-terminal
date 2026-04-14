using System.Collections.Concurrent;
using System.Threading.Channels;
using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Notifications;
using KAITerminal.Contracts.Streaming;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Workers;

/// <summary>
/// One <see cref="Task"/> per user session drives everything: LTP ticks arrive via a
/// per-user <see cref="Channel{T}"/>, the poll timer fires via <c>CancelAfter</c>, and an
/// optional refresh signal from auto-shift wakes the loop early.  Because evaluation always
/// runs on a single task there are no concurrency primitives — no semaphores, no gates, no
/// concurrent <c>Task.Run</c> for ticks — making the control flow easy to follow and test.
/// </summary>
public sealed class StreamingRiskWorker : BackgroundService, IPositionRefreshTrigger
{
    private readonly IUserTokenSource            _tokenSource;
    private readonly IBrokerClientFactory        _brokerFactory;
    private readonly IPositionCache              _cache;
    private readonly IRiskRepository             _repo;
    private readonly RiskEvaluator               _evaluator;
    private readonly IAutoShiftEvaluator         _autoShift;
    private readonly IRiskEventNotifier          _notifier;
    private readonly ISharedMarketDataService    _sharedMarketData;
    private readonly ITokenMapper                _tokenMapper;
    private readonly RiskEngineConfig            _cfg;
    private readonly ILogger<StreamingRiskWorker> _logger;
    private readonly TimeZoneInfo                _tradingTz;

    // Keyed by "{userId}::{brokerType}"
    private readonly ConcurrentDictionary<string, Channel<LtpUpdate>> _ltpChannels    = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, Channel<bool>>      _refreshChannels = new(StringComparer.Ordinal);

    private readonly UserSessionRegistry _sessionRegistry;
    private int _tradingWindowState = -1;

    private static string Key(UserConfig u) => $"{u.UserId}::{u.BrokerType}";

    public StreamingRiskWorker(
        IUserTokenSource            tokenSource,
        IBrokerClientFactory        brokerFactory,
        IPositionCache              cache,
        IRiskRepository             repo,
        RiskEvaluator               evaluator,
        IAutoShiftEvaluator         autoShift,
        IRiskEventNotifier          notifier,
        ISharedMarketDataService    sharedMarketData,
        ITokenMapper                tokenMapper,
        IOptions<RiskEngineConfig>  cfg,
        ILogger<StreamingRiskWorker> logger)
    {
        _tokenSource      = tokenSource;
        _brokerFactory    = brokerFactory;
        _cache            = cache;
        _repo             = repo;
        _evaluator        = evaluator;
        _autoShift        = autoShift;
        _notifier         = notifier;
        _sharedMarketData = sharedMarketData;
        _tokenMapper      = tokenMapper;
        _cfg              = cfg.Value;
        _logger           = logger;
        _tradingTz        = TimeZoneInfo.FindSystemTimeZoneById(_cfg.TradingTimeZone);

        _sessionRegistry = new UserSessionRegistry(
            _repo,
            _logger,
            onSessionRemoved: key =>
            {
                _ltpChannels.TryRemove(key, out _);
                _refreshChannels.TryRemove(key, out _);
            },
            sessionFactory: RunUserWithRestartAsync);
    }

    // ── IPositionRefreshTrigger ──────────────────────────────────────────────

    /// <summary>Wakes the eval loop immediately for this user+broker. Safe to call from any thread.</summary>
    public void RequestRefresh(string cacheKey)
    {
        var ch = _refreshChannels.GetOrAdd(cacheKey, _ =>
            Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
                { FullMode = BoundedChannelFullMode.DropOldest }));
        ch.Writer.TryWrite(true);
    }

    // ── Supervisor ───────────────────────────────────────────────────────────

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "RiskWorker started — trading window {Start}–{End} {Tz}, poll every {PollMs}ms, user refresh every {RefreshMs}ms",
            _cfg.TradingWindowStart.ToString(@"hh\:mm"),
            _cfg.TradingWindowEnd.ToString(@"hh\:mm"),
            _cfg.TradingTimeZone,
            _cfg.PositionPollIntervalMs,
            _cfg.UserRefreshIntervalMs);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var users = await _tokenSource.GetUsersAsync(stoppingToken);
                await _sessionRegistry.SyncSessionsAsync(users, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Supervisor loop error — will retry in {Ms}ms", _cfg.UserRefreshIntervalMs);
            }

            try { await Task.Delay(_cfg.UserRefreshIntervalMs, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }

        var allEntries = _sessionRegistry.AllSessions.ToList();
        foreach (var entry in allEntries) entry.Cts.Cancel();
        await Task.WhenAll(allEntries.Select(e => e.Task));

        _logger.LogInformation("RiskWorker stopped");
    }

    // ── Per-user session (with restart) ─────────────────────────────────────

    private async Task RunUserWithRestartAsync(UserConfig user, CancellationToken ct)
    {
        const int initialDelaySeconds = 30;
        const int maxDelaySeconds     = 300;
        int delaySeconds = initialDelaySeconds;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await RunUserAsync(user, ct);
                return;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch
            {
                _logger.LogWarning("Restarting session — {UserId} ({Broker}) in {Delay}s",
                    user.UserId, user.BrokerType, delaySeconds);
                try { await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct); }
                catch (OperationCanceledException) { return; }
                delaySeconds = Math.Min(delaySeconds * 2, maxDelaySeconds);
            }
        }
    }

    private async Task RunUserAsync(UserConfig user, CancellationToken ct)
    {
        var stateKey = Key(user);

        // Guard against forgotten daily restart — reset state if it belongs to a previous day.
        var today    = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, _tradingTz).DateTime);
        var existing = await _repo.GetOrCreateAsync(stateKey);
        if (existing.LastResetDate < today)
        {
            _logger.LogInformation("New trading day — resetting risk state for {UserId} ({Broker})",
                user.UserId, user.BrokerType);
            await _repo.ResetAsync(stateKey);
            await _repo.MutateAsync(stateKey, s => s.LastResetDate = today);
        }

        var broker = _brokerFactory.Create(user.BrokerType, user.AccessToken, user.ApiKey);

        // ── Initial position fetch and feed subscription ──────────────────
        await PollPositionsAsync(user, broker, isStartup: true, ct);

        // ── LTP channel: event handler just enqueues, eval loop processes ─
        // A fresh channel per session avoids stale ticks from a previous restart.
        var ltpChannel = Channel.CreateBounded<LtpUpdate>(
            new BoundedChannelOptions(200) { FullMode = BoundedChannelFullMode.DropOldest });
        _ltpChannels[stateKey] = ltpChannel;

        var refreshChannel = _refreshChannels.GetOrAdd(stateKey, _ =>
            Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
                { FullMode = BoundedChannelFullMode.DropOldest }));

        // Thread-safe: just write to the channel — no async, no Task.Run needed
        EventHandler<LtpUpdate> ltpHandler = (_, update) => ltpChannel.Writer.TryWrite(update);
        _sharedMarketData.FeedReceived += ltpHandler;

        try
        {
            await RunEvalLoopAsync(user, broker, ltpChannel.Reader, refreshChannel.Reader, ct);
        }
        finally
        {
            _sharedMarketData.FeedReceived -= ltpHandler;

            var openTokens = _cache.GetOpenInstrumentTokens(stateKey);
            if (openTokens.Count > 0)
            {
                try
                {
                    var feedTokens = _tokenMapper.ToFeedTokens(user.BrokerType, openTokens);
                    await _sharedMarketData.UnsubscribeAsync(feedTokens);
                }
                catch { /* best-effort on shutdown */ }
            }
        }
    }

    // ── Unified eval loop — single Task per user, no concurrency needed ──────

    private async Task RunEvalLoopAsync(
        UserConfig               user,
        IBrokerClient            broker,
        ChannelReader<LtpUpdate> ltpReader,
        ChannelReader<bool>      refreshReader,
        CancellationToken        ct)
    {
        // Initial poll already done in RunUserAsync; schedule the next one after the full interval.
        var stateKey   = Key(user);
        var nextPollAt = DateTimeOffset.UtcNow.AddMilliseconds(_cfg.PositionPollIntervalMs);
        var lastEvalAt = DateTimeOffset.MinValue;
        var minEvalGap = TimeSpan.FromMilliseconds(_cfg.LtpEvalMinIntervalMs);

        while (!ct.IsCancellationRequested)
        {
            try
            {
                // ── 1. Drain all pending LTP ticks into the cache ────────────────
                var openTokens = _cache.GetOpenInstrumentTokens(stateKey);
                var latestLtp  = LtpTickDrainer.DrainLatest(ltpReader);
                bool anyNewLtp = false;
                foreach (var (feedToken, ltp) in latestLtp)
                {
                    var native = _tokenMapper.ToNativeToken(user.BrokerType, feedToken);
                    if (!openTokens.Contains(native)) continue;
                    _cache.UpdateLtp(stateKey, native, ltp);
                    anyNewLtp = true;
                }

                // ── 2. Poll positions if timer fired or refresh requested ─────────
                bool refreshRequested = refreshReader.TryRead(out _);
                bool pollDue          = DateTimeOffset.UtcNow >= nextPollAt || refreshRequested;

                if (pollDue)
                {
                    await PollPositionsAsync(user, broker, isStartup: false, ct);
                    nextPollAt = DateTimeOffset.UtcNow.AddMilliseconds(_cfg.PositionPollIntervalMs);
                    openTokens = _cache.GetOpenInstrumentTokens(stateKey); // refresh after poll
                }

                // ── 3. Evaluate risk ──────────────────────────────────────────────
                //  • Always evaluate after a poll (positions may have changed)
                //  • For LTP-only wakeups, rate-limit to avoid evaluating on every tick
                var now         = DateTimeOffset.UtcNow;
                bool ltpEvalDue = anyNewLtp && (now - lastEvalAt) >= minEvalGap;

                if ((pollDue || ltpEvalDue) && CheckTradingWindow())
                {
                    if (openTokens.Count > 0)
                    {
                        lastEvalAt = now;
                        var mtm = _cache.GetMtm(stateKey);
                        await _evaluator.EvaluateAsync(user.UserId, mtm, user, broker, ct);
                        await _autoShift.EvaluateAsync(user, broker, ct);
                    }
                    else
                    {
                        _logger.LogDebug("No open positions — skipping evaluation for {UserId} ({Broker})",
                            user.UserId, user.BrokerType);
                    }
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                // Transient error (network blip, broker timeout) — log and continue.
                // The session keeps running; the next poll will retry.
                _logger.LogError(ex, "Error in eval loop — {UserId} ({Broker})", user.UserId, user.BrokerType);
            }

            // ── 4. Sleep until the next LTP tick, refresh signal, or poll time ─
            // Task.WhenAny never throws; CancelAfter acts as the poll timer.
            var sleepMs = (int)Math.Max(0, (nextPollAt - DateTimeOffset.UtcNow).TotalMilliseconds);
            using var sleepCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            sleepCts.CancelAfter(sleepMs);
            await Task.WhenAny(
                ltpReader.WaitToReadAsync(sleepCts.Token).AsTask(),
                refreshReader.WaitToReadAsync(sleepCts.Token).AsTask());
        }
    }

    // ── Position poll ─────────────────────────────────────────────────────────

    private async Task PollPositionsAsync(UserConfig user, IBrokerClient broker, bool isStartup, CancellationToken ct)
    {
        _logger.LogDebug("Polling positions — {UserId} ({Broker})", user.UserId, user.BrokerType);

        var rawPositions = await broker.GetAllPositionsAsync(ct);
        var positions = user.WatchedProducts == "All"
            ? rawPositions
            : rawPositions
                .Where(p => ProductTypeFilter.Matches(p.Product, user.WatchedProducts))
                .ToList()
                .AsReadOnly();

        if (isStartup)
        {
            if (user.WatchedProducts == "All")
                _logger.LogInformation("Positions loaded — {UserId} ({Broker}) | {Count} position(s) [all products]",
                    user.UserId, user.BrokerType, positions.Count);
            else
                _logger.LogInformation(
                    "Positions loaded — {UserId} ({Broker}) | {Watched}/{Total} position(s) [{Filter} only — {Excluded} excluded]",
                    user.UserId, user.BrokerType, positions.Count, rawPositions.Count,
                    user.WatchedProducts, rawPositions.Count - positions.Count);
        }
        else
        {
            _logger.LogDebug("Position poll — {UserId} ({Broker}) | {Watched}/{Total} [{Filter}]",
                user.UserId, user.BrokerType, positions.Count, rawPositions.Count, user.WatchedProducts);
        }

        _cache.UpdatePositions(Key(user), positions);

        // Subscribe any new open instruments to the shared LTP feed
        var openTokens = _cache.GetOpenInstrumentTokens(Key(user));
        if (openTokens.Count > 0)
        {
            await _tokenMapper.EnsureReadyAsync(user.BrokerType, ct);
            var feedTokens = _tokenMapper.ToFeedTokens(user.BrokerType, openTokens);

            if (isStartup)
                _logger.LogInformation("Subscribing {Count} instrument(s) — {UserId} ({Broker})",
                    feedTokens.Count, user.UserId, user.BrokerType);

            await _sharedMarketData.SubscribeAsync(feedTokens, FeedMode.Ltpc, ct);
        }

        if (isStartup)
        {
            var watchLabel = user.WatchedProducts switch
            {
                "Intraday" => "Intraday",
                "Delivery" => "Delivery",
                _          => "Intraday + Delivery",
            };
            var totalOpen = rawPositions.Count(p => p.IsOpen);
            if (user.WatchedProducts == "All" || totalOpen == openTokens.Count)
                _logger.LogInformation("Streams live — {UserId} ({Broker})  watching {Count} open instrument(s) [{Watch}]",
                    user.UserId, user.BrokerType, openTokens.Count, watchLabel);
            else
                _logger.LogWarning(
                    "Streams live — {UserId} ({Broker})  watching {Watched}/{Total} open instrument(s) [{Watch} filter — {Excluded} excluded]",
                    user.UserId, user.BrokerType, openTokens.Count, totalOpen, watchLabel, totalOpen - openTokens.Count);

            if (openTokens.Count > 0)
                await _notifier.NotifyAsync(new RiskNotification(
                    user.UserId, user.BrokerType, RiskNotificationType.SessionStarted,
                    _cache.GetMtm(Key(user)),
                    Target:            user.MtmTarget,
                    Sl:                user.MtmSl,
                    OpenPositionCount: openTokens.Count,
                    Timestamp:         DateTimeOffset.UtcNow), ct);
        }
    }

    // ── Trading window ────────────────────────────────────────────────────────

    private bool CheckTradingWindow()
    {
        var now      = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, _tradingTz).TimeOfDay;
        bool inWindow = now >= _cfg.TradingWindowStart && now <= _cfg.TradingWindowEnd;

        int newState = inWindow ? 1 : 0;
        int prev     = Interlocked.Exchange(ref _tradingWindowState, newState);

        if (prev != newState)
        {
            if (inWindow)
                _logger.LogInformation("Market open — risk engine active ({Start}–{End} {Tz})",
                    _cfg.TradingWindowStart.ToString(@"hh\:mm"),
                    _cfg.TradingWindowEnd.ToString(@"hh\:mm"),
                    _cfg.TradingTimeZone);
            else
                _logger.LogInformation("Market closed — risk engine paused until {Start} {Tz}",
                    _cfg.TradingWindowStart.ToString(@"hh\:mm"),
                    _cfg.TradingTimeZone);
        }

        return inWindow;
    }
}
