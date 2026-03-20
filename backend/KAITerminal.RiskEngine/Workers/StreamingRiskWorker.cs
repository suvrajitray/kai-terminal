using System.Collections.Concurrent;
using System.Diagnostics;
using KAITerminal.Broker;
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
/// Polling + streaming risk worker.
/// <para>
/// Per user: creates a broker client via <see cref="IBrokerClientFactory"/> for REST calls,
/// subscribes to <see cref="ISharedMarketDataService"/> for LTP ticks (shared across all users),
/// and polls positions via REST every <see cref="RiskEngineConfig.PositionPollIntervalMs"/> ms.
/// LTP-triggered evaluations are rate-limited via <see cref="RiskEngineConfig.LtpEvalMinIntervalMs"/>.
/// Portfolio events (fills) are detected via the position poll, not a WebSocket stream.
/// </para>
/// </summary>
public sealed class StreamingRiskWorker : BackgroundService
{
    private readonly IUserTokenSource         _tokenSource;
    private readonly IBrokerClientFactory     _brokerFactory;
    private readonly IPositionCache           _cache;
    private readonly IRiskRepository          _repo;
    private readonly RiskEvaluator            _evaluator;
    private readonly IRiskEventNotifier       _notifier;
    private readonly ISharedMarketDataService _sharedMarketData;
    private readonly RiskEngineConfig         _cfg;
    private readonly ILogger<StreamingRiskWorker> _logger;
    private readonly TimeZoneInfo             _tradingTz;

    private readonly ConcurrentDictionary<string, UserGate>    _gates    = new(StringComparer.Ordinal);
    private readonly Dictionary<string, SessionEntry>           _sessions = new(StringComparer.Ordinal);

    private int _tradingWindowState = -1;

    private sealed class UserGate
    {
        public readonly SemaphoreSlim Sem = new(1, 1);
        public long LastLtpEvalTicks;
    }

    private sealed class SessionEntry
    {
        public required CancellationTokenSource Cts    { get; init; }
        public required Task                    Task   { get; init; }
        public required UserConfig              Config { get; init; }
    }

    private static string SessionKey(UserConfig u) => $"{u.UserId}::{u.BrokerType}";

    public StreamingRiskWorker(
        IUserTokenSource         tokenSource,
        IBrokerClientFactory     brokerFactory,
        IPositionCache           cache,
        IRiskRepository          repo,
        RiskEvaluator            evaluator,
        IRiskEventNotifier       notifier,
        ISharedMarketDataService sharedMarketData,
        IOptions<RiskEngineConfig> cfg,
        ILogger<StreamingRiskWorker> logger)
    {
        _tokenSource      = tokenSource;
        _brokerFactory    = brokerFactory;
        _cache            = cache;
        _repo             = repo;
        _evaluator        = evaluator;
        _notifier         = notifier;
        _sharedMarketData = sharedMarketData;
        _cfg              = cfg.Value;
        _logger           = logger;
        _tradingTz        = TimeZoneInfo.FindSystemTimeZoneById(_cfg.TradingTimeZone);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "RiskWorker started — trading window {Start}–{End} {Tz}, LTP eval every {IntervalMs}ms, " +
            "position poll every {PollMs}ms, user refresh every {RefreshMs}ms",
            _cfg.TradingWindowStart.ToString(@"hh\:mm"),
            _cfg.TradingWindowEnd.ToString(@"hh\:mm"),
            _cfg.TradingTimeZone,
            _cfg.LtpEvalMinIntervalMs,
            _cfg.PositionPollIntervalMs,
            _cfg.UserRefreshIntervalMs);

        // Supervisor loop: re-queries DB every UserRefreshIntervalMs.
        // Starts sessions for new users, restarts on config change, stops for removed/disabled users.
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var users = await _tokenSource.GetUsersAsync(stoppingToken);
                await SyncSessionsAsync(users, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Supervisor loop error — will retry in {Ms}ms", _cfg.UserRefreshIntervalMs);
            }

            try { await Task.Delay(_cfg.UserRefreshIntervalMs, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }

        // Shutdown: cancel all running sessions and wait for them to exit
        var allEntries = _sessions.Values.ToList();
        foreach (var entry in allEntries)
            entry.Cts.Cancel();

        await Task.WhenAll(allEntries.Select(e => e.Task));

        _logger.LogInformation("RiskWorker stopped");
    }

    // ── Supervisor ────────────────────────────────────────────────────────────

    private async Task SyncSessionsAsync(IReadOnlyList<UserConfig> freshUsers, CancellationToken stoppingToken)
    {
        var freshByKey = freshUsers.ToDictionary(SessionKey, StringComparer.Ordinal);

        // Stop sessions for users no longer present or whose config changed
        var toStop = _sessions
            .Where(kvp => !freshByKey.TryGetValue(kvp.Key, out var fresh) || HasConfigChanged(kvp.Value.Config, fresh))
            .ToList();

        foreach (var (key, entry) in toStop)
        {
            bool configChanged = freshByKey.ContainsKey(key);
            var reason = configChanged ? "config changed" : "disabled or token expired";
            _logger.LogInformation(
                "Stopping session ({Reason}) — {UserId} ({Broker})",
                reason, entry.Config.UserId, entry.Config.BrokerType);
            entry.Cts.Cancel();
            _sessions.Remove(key);

            // Config change = intentional reconfiguration; wipe TSL floor and squared-off state
            // so the new session starts clean with the updated parameters.
            if (configChanged)
                _repo.Reset(entry.Config.UserId);
        }

        // Wait for stopped sessions to exit cleanly before restarting them
        if (toStop.Count > 0)
            await Task.WhenAll(toStop.Select(x => x.Value.Task));

        // Start sessions for new users (including restarts after config change)
        foreach (var user in freshUsers)
        {
            var key = SessionKey(user);
            if (_sessions.ContainsKey(key)) continue;

            _logger.LogInformation("Starting session — {UserId} ({Broker})", user.UserId, user.BrokerType);
            var cts  = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            var task = RunUserWithRestartAsync(user, cts.Token);
            _sessions[key] = new SessionEntry { Cts = cts, Task = task, Config = user };
        }
    }

    private static bool HasConfigChanged(UserConfig old, UserConfig next) =>
        old.AccessToken           != next.AccessToken           ||
        old.MtmTarget             != next.MtmTarget             ||
        old.MtmSl                 != next.MtmSl                 ||
        old.TrailingEnabled       != next.TrailingEnabled       ||
        old.TrailingActivateAt    != next.TrailingActivateAt    ||
        old.LockProfitAt          != next.LockProfitAt          ||
        old.WhenProfitIncreasesBy != next.WhenProfitIncreasesBy ||
        old.IncreaseTrailingBy    != next.IncreaseTrailingBy;

    // ── Per-user session ─────────────────────────────────────────────────────

    private async Task RunUserAsync(UserConfig user, CancellationToken ct)
    {
        _logger.LogInformation("Starting session — {UserId} ({Broker})", user.UserId, user.BrokerType);

        // Reset risk state at the start of each new trading day so stale TSL / squared-off
        // flags from yesterday do not carry over into today's session.
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, _tradingTz).DateTime);
        var existingState = _repo.GetOrCreate(user.UserId);
        if (existingState.LastSessionDate < today)
        {
            _logger.LogInformation(
                "New trading day — resetting risk state for {UserId} ({Broker})",
                user.UserId, user.BrokerType);
            _repo.Update(user.UserId, new UserRiskState { LastSessionDate = today });
        }

        var broker = _brokerFactory.Create(user.BrokerType, user.AccessToken, user.ApiKey);

        // ── Initial position fetch ────────────────────────────────────────
        var positions = _cfg.FilterPositions(await broker.GetAllPositionsAsync(ct));
        _cache.UpdatePositions(user.UserId, positions);  // also clears stale LTP

        var tokens = _cache.GetOpenInstrumentTokens(user.UserId);

        // ── Subscribe to shared market data ───────────────────────────────
        if (tokens.Count > 0)
        {
            _logger.LogInformation(
                "Subscribing {Count} instrument(s) — {UserId} ({Broker})",
                tokens.Count, user.UserId, user.BrokerType);
            await _sharedMarketData.SubscribeAsync(tokens, FeedMode.Ltpc, ct);
        }

        var openCount = tokens.Count;
        _logger.LogInformation(
            "Streams live — {UserId} ({Broker})  watching {Count} open instrument(s)",
            user.UserId, user.BrokerType, openCount);

        if (openCount > 0)
        {
            await _notifier.NotifyAsync(new RiskNotification(
                user.UserId, user.BrokerType, RiskNotificationType.SessionStarted,
                _cache.GetMtm(user.UserId),
                OpenPositionCount: openCount,
                Timestamp: DateTimeOffset.UtcNow), ct);
        }

        // ── LTP event handler ─────────────────────────────────────────────
        EventHandler<LtpUpdate> ltpHandler = (_, update) =>
            _ = Task.Run(() => HandleLtpTickAsync(user, broker, update, ct));

        _sharedMarketData.FeedReceived += ltpHandler;

        try
        {
            // ── Position poll loop (replaces portfolio stream) ────────────
            await RunPositionPollLoopAsync(user, broker, ct);
        }
        finally
        {
            _sharedMarketData.FeedReceived -= ltpHandler;

            // Unsubscribe this user's instruments from shared feed
            var currentTokens = _cache.GetOpenInstrumentTokens(user.UserId);
            if (currentTokens.Count > 0)
            {
                try { await _sharedMarketData.UnsubscribeAsync(currentTokens); }
                catch { /* best-effort on shutdown */ }
            }
        }
    }

    // ── Session restart wrapper ──────────────────────────────────────────────

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
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch
            {
                _logger.LogWarning(
                    "Restarting session — {UserId} ({Broker}) in {Delay}s",
                    user.UserId, user.BrokerType, delaySeconds);

                try { await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct); }
                catch (OperationCanceledException) { return; }

                delaySeconds = Math.Min(delaySeconds * 2, maxDelaySeconds);
            }
        }
    }

    // ── Position poll loop ────────────────────────────────────────────────────

    private async Task RunPositionPollLoopAsync(UserConfig user, IBrokerClient broker, CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_cfg.PositionPollIntervalMs, ct);

                _logger.LogDebug("Polling positions — {UserId} ({Broker})", user.UserId, user.BrokerType);

                var positions = _cfg.FilterPositions(await broker.GetAllPositionsAsync(ct));
                _cache.UpdatePositions(user.UserId, positions);  // clears stale LTP

                // Re-subscribe if open instruments changed
                var newTokens = _cache.GetOpenInstrumentTokens(user.UserId);
                if (newTokens.Count > 0)
                    await _sharedMarketData.SubscribeAsync(newTokens, FeedMode.Ltpc, ct);

                await EvaluateAsync(user, broker, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in position poll — {UserId} ({Broker})", user.UserId, user.BrokerType);
            }
        }
    }

    // ── LTP tick handler ─────────────────────────────────────────────────────

    private async Task HandleLtpTickAsync(
        UserConfig user, IBrokerClient broker, LtpUpdate update, CancellationToken ct)
    {
        // Filter to only this user's open instruments
        var userTokens = _cache.GetOpenInstrumentTokens(user.UserId);
        bool relevant = false;
        foreach (var (token, ltp) in update.Ltps)
        {
            if (!userTokens.Contains(token)) continue;
            _cache.UpdateLtp(user.UserId, token, ltp);
            relevant = true;
        }

        if (!relevant) return;

        if (!CanEvaluateFromLtp(user.UserId))
        {
            _logger.LogDebug("LTP eval rate-limited — {UserId} ({Broker})", user.UserId, user.BrokerType);
            return;
        }

        try
        {
            await EvaluateAsync(user, broker, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in LTP evaluation — {UserId} ({Broker})", user.UserId, user.BrokerType);
        }
    }

    // ── Risk evaluation helper ───────────────────────────────────────────────

    private async Task EvaluateAsync(UserConfig user, IBrokerClient broker, CancellationToken ct)
    {
        if (!CheckTradingWindow())
        {
            _logger.LogDebug("Outside trading hours — skipping evaluation for {UserId} ({Broker})", user.UserId, user.BrokerType);
            return;
        }

        var gate = _gates.GetOrAdd(user.UserId, _ => new UserGate());
        if (!await gate.Sem.WaitAsync(0, ct))
        {
            _logger.LogDebug("Evaluation in progress — skipping for {UserId} ({Broker})", user.UserId, user.BrokerType);
            return;
        }
        try
        {
            var mtm = _cache.GetMtm(user.UserId);
            await _evaluator.EvaluateAsync(user.UserId, mtm, user, broker, ct);
        }
        finally
        {
            gate.Sem.Release();
        }
    }

    private bool CheckTradingWindow()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, _tradingTz).TimeOfDay;
        bool inWindow = now >= _cfg.TradingWindowStart && now <= _cfg.TradingWindowEnd;

        int newState = inWindow ? 1 : 0;
        int prev = Interlocked.Exchange(ref _tradingWindowState, newState);

        if (prev != newState)
        {
            if (inWindow)
                _logger.LogInformation(
                    "Market open — risk engine active ({Start}–{End} {Tz})",
                    _cfg.TradingWindowStart.ToString(@"hh\:mm"),
                    _cfg.TradingWindowEnd.ToString(@"hh\:mm"),
                    _cfg.TradingTimeZone);
            else
                _logger.LogInformation(
                    "Market closed — risk engine paused until {Start} {Tz}",
                    _cfg.TradingWindowStart.ToString(@"hh\:mm"),
                    _cfg.TradingTimeZone);
        }

        return inWindow;
    }

    private bool CanEvaluateFromLtp(string userId)
    {
        var gate = _gates.GetOrAdd(userId, _ => new UserGate());
        var now  = Stopwatch.GetTimestamp();
        var minInterval = (long)(_cfg.LtpEvalMinIntervalMs / 1000.0 * Stopwatch.Frequency);
        var last = Volatile.Read(ref gate.LastLtpEvalTicks);

        if (now - last < minInterval) return false;

        return Interlocked.CompareExchange(ref gate.LastLtpEvalTicks, now, last) == last;
    }
}
