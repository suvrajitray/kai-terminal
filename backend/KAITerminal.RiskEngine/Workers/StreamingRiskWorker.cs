using System.Collections.Concurrent;
using System.Threading.Channels;
using KAITerminal.Broker;
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
    private const int    LtpChannelCapacity = 200;
    private const string Sep = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

    private readonly IUserTokenSource             _tokenSource;
    private readonly IBrokerClientFactory         _brokerFactory;
    private readonly IPositionCache               _cache;
    private readonly IRiskRepository              _repo;
    private readonly RiskEvaluator                _evaluator;
    private readonly IAutoShiftEvaluator          _autoShift;
    private readonly ISharedMarketDataService     _sharedMarketData;
    private readonly ITokenMapper                 _tokenMapper;
    private readonly PositionPoller               _positionPoller;
    private readonly TradingWindow                _tradingWindow;
    private readonly RiskEngineConfig             _cfg;
    private readonly ILogger<StreamingRiskWorker> _logger;
    private readonly TimeZoneInfo                 _tradingTz;

    // Keyed by "{userId}::{brokerType}"
    private readonly ConcurrentDictionary<string, Channel<LtpUpdate>> _ltpChannels     = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, Channel<bool>>      _refreshChannels = new(StringComparer.Ordinal);

    private readonly UserSessionRegistry _sessionRegistry;

    private static string Key(UserConfig u) => $"{u.UserId}::{u.BrokerType}";

    public StreamingRiskWorker(
        IUserTokenSource             tokenSource,
        IBrokerClientFactory         brokerFactory,
        IPositionCache               cache,
        IRiskRepository              repo,
        RiskEvaluator                evaluator,
        IAutoShiftEvaluator          autoShift,
        ISharedMarketDataService     sharedMarketData,
        ITokenMapper                 tokenMapper,
        PositionPoller               positionPoller,
        TradingWindow                tradingWindow,
        IOptions<RiskEngineConfig>   cfg,
        ILogger<StreamingRiskWorker> logger)
    {
        _tokenSource      = tokenSource;
        _brokerFactory    = brokerFactory;
        _cache            = cache;
        _repo             = repo;
        _evaluator        = evaluator;
        _autoShift        = autoShift;
        _sharedMarketData = sharedMarketData;
        _tokenMapper      = tokenMapper;
        _positionPoller   = positionPoller;
        _tradingWindow    = tradingWindow;
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
        LogStartupBanner();

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
                _logger.LogError(ex, "[ERROR] Supervisor loop error — retrying in {Ms}ms", _cfg.UserRefreshIntervalMs);
            }

            try { await Task.Delay(_cfg.UserRefreshIntervalMs, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }

        var allEntries = _sessionRegistry.AllSessions.ToList();
        foreach (var entry in allEntries) entry.Cts.Cancel();
        await Task.WhenAll(allEntries.Select(e => e.Task));

        _logger.LogInformation("[RISK ] Stopped");
    }

    private void LogStartupBanner()
    {
        _logger.LogInformation(Sep);
        _logger.LogInformation("  KAI Terminal — Risk Worker");
        _logger.LogInformation("  Trading window  :  {Start}–{End}  ({Tz})",
            _cfg.TradingWindowStart.ToString(@"hh\:mm"),
            _cfg.TradingWindowEnd.ToString(@"hh\:mm"),
            _cfg.TradingTimeZone);
        _logger.LogInformation("  Position poll   :  {PollMs}ms", _cfg.PositionPollIntervalMs);
        _logger.LogInformation("  User refresh    :  {RefreshMs}ms", _cfg.UserRefreshIntervalMs);
        _logger.LogInformation(Sep);
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
                _logger.LogWarning("[SESS ] Restarting — {UserId} ({Broker}) in {Delay}s",
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
        await ResetIfNewTradingDayAsync(stateKey, user, ct);

        var broker = _brokerFactory.Create(user.BrokerType, user.AccessToken, user.ApiKey, user.UserId);

        // Stale LTPs from a previous session would corrupt the first MTM; clear them
        // so we fall back to the broker's REST P&L until a fresh tick arrives.
        _cache.ResetLtp(stateKey);

        await _positionPoller.PollAsync(stateKey, user, broker, isStartup: true, ct);

        var ltpChannel = Channel.CreateBounded<LtpUpdate>(
            new BoundedChannelOptions(LtpChannelCapacity) { FullMode = BoundedChannelFullMode.DropOldest });
        _ltpChannels[stateKey] = ltpChannel;

        var refreshChannel = _refreshChannels.GetOrAdd(stateKey, _ =>
            Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
                { FullMode = BoundedChannelFullMode.DropOldest }));

        EventHandler<LtpUpdate> ltpHandler = (_, update) => ltpChannel.Writer.TryWrite(update);
        _sharedMarketData.FeedReceived += ltpHandler;

        try
        {
            await RunEvalLoopAsync(user, broker, ltpChannel.Reader, refreshChannel.Reader, ct);
        }
        finally
        {
            _sharedMarketData.FeedReceived -= ltpHandler;
            await UnsubscribeOpenInstrumentsAsync(stateKey, user);
        }
    }

    private async Task ResetIfNewTradingDayAsync(string stateKey, UserConfig user, CancellationToken ct)
    {
        var today    = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, _tradingTz).DateTime);
        var existing = await _repo.ReadAsync(stateKey, s => s.ToSnapshot());
        if (existing.LastResetDate >= today) return;

        _logger.LogInformation("[SESS ] New trading day — resetting state  |  {UserId} ({Broker})",
            user.UserId, user.BrokerType);
        await _repo.ResetAsync(stateKey);
        await _repo.MutateAsync(stateKey, s => s.LastResetDate = today);
    }

    private async Task UnsubscribeOpenInstrumentsAsync(string stateKey, UserConfig user)
    {
        var openTokens = _cache.GetOpenInstrumentTokens(stateKey);
        if (openTokens.Count == 0) return;
        try
        {
            var feedTokens = _tokenMapper.ToFeedTokens(user.BrokerType, openTokens);
            await _sharedMarketData.UnsubscribeAsync(feedTokens);
        }
        catch { /* best-effort on shutdown */ }
    }

    // ── Unified eval loop — single Task per user, no concurrency needed ──────

    private async Task RunEvalLoopAsync(
        UserConfig               user,
        IBrokerClient            broker,
        ChannelReader<LtpUpdate> ltpReader,
        ChannelReader<bool>      refreshReader,
        CancellationToken        ct)
    {
        var stateKey   = Key(user);
        var nextPollAt = DateTimeOffset.UtcNow.AddMilliseconds(_cfg.PositionPollIntervalMs);
        var lastEvalAt = DateTimeOffset.MinValue;
        var minEvalGap = TimeSpan.FromMilliseconds(_cfg.LtpEvalMinIntervalMs);

        while (!ct.IsCancellationRequested)
        {
            try
            {
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

                bool refreshRequested = refreshReader.TryRead(out _);
                bool pollDue          = DateTimeOffset.UtcNow >= nextPollAt || refreshRequested;

                if (pollDue)
                {
                    await _positionPoller.PollAsync(stateKey, user, broker, isStartup: false, ct);
                    nextPollAt = DateTimeOffset.UtcNow.AddMilliseconds(_cfg.PositionPollIntervalMs);
                    openTokens = _cache.GetOpenInstrumentTokens(stateKey);
                }

                var now         = DateTimeOffset.UtcNow;
                bool ltpEvalDue = anyNewLtp && (now - lastEvalAt) >= minEvalGap;

                if ((pollDue || ltpEvalDue) && _tradingWindow.IsOpen())
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
                        _logger.LogDebug("[EVAL ] No open positions — skipping  |  {UserId} ({Broker})",
                            user.UserId, user.BrokerType);
                    }
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[ERROR] Eval loop error — {UserId} ({Broker})", user.UserId, user.BrokerType);
            }

            var sleepMs = (int)Math.Max(0, (nextPollAt - DateTimeOffset.UtcNow).TotalMilliseconds);
            using var sleepCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            sleepCts.CancelAfter(sleepMs);
            await Task.WhenAny(
                ltpReader.WaitToReadAsync(sleepCts.Token).AsTask(),
                refreshReader.WaitToReadAsync(sleepCts.Token).AsTask());
        }
    }
}
