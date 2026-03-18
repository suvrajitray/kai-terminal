using System.Collections.Concurrent;
using System.Diagnostics;
using KAITerminal.Broker;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Services;
using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Workers;

/// <summary>
/// WebSocket-driven risk worker.
/// <para>
/// Per user: creates a broker client via <see cref="IBrokerClientFactory"/>, then connects
/// a Portfolio stream and a Market Data stream.
/// Portfolio events trigger a REST position re-fetch + full risk evaluation.
/// LTP ticks update the in-memory cache and trigger a rate-limited portfolio risk check
/// (no REST call — MTM is computed from the cache).
/// </para>
/// </summary>
public sealed class StreamingRiskWorker : BackgroundService
{
    private readonly IUserTokenSource    _tokenSource;
    private readonly IBrokerClientFactory _brokerFactory;
    private readonly IPositionCache      _cache;
    private readonly RiskEvaluator       _evaluator;
    private readonly RiskEngineConfig    _cfg;
    private readonly ILogger<StreamingRiskWorker> _logger;
    private readonly TimeZoneInfo        _tradingTz;

    private readonly ConcurrentDictionary<string, UserGate> _gates = new(StringComparer.Ordinal);

    private int _tradingWindowState = -1;

    private sealed class UserGate
    {
        public readonly SemaphoreSlim Sem = new(1, 1);
        public long LastLtpEvalTicks;
    }

    public StreamingRiskWorker(
        IUserTokenSource     tokenSource,
        IBrokerClientFactory brokerFactory,
        IPositionCache       cache,
        RiskEvaluator        evaluator,
        IOptions<RiskEngineConfig> cfg,
        ILogger<StreamingRiskWorker> logger)
    {
        _tokenSource   = tokenSource;
        _brokerFactory = brokerFactory;
        _cache         = cache;
        _evaluator     = evaluator;
        _cfg           = cfg.Value;
        _logger        = logger;
        _tradingTz     = TimeZoneInfo.FindSystemTimeZoneById(_cfg.TradingTimeZone);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "StreamingRiskWorker started — trading window={Start}–{End} {Tz}  LTP eval interval={IntervalMs}ms",
            _cfg.TradingWindowStart.ToString(@"hh\:mm"),
            _cfg.TradingWindowEnd.ToString(@"hh\:mm"),
            _cfg.TradingTimeZone,
            _cfg.LtpEvalMinIntervalMs);

        var users = await _tokenSource.GetUsersAsync(stoppingToken);
        if (!users.Any())
        {
            _logger.LogWarning("StreamingRiskWorker: no users configured — nothing to monitor");
            return;
        }

        _logger.LogInformation("Starting risk sessions for {Count} user(s)", users.Count());

        await Task.WhenAll(users.Select(u => RunUserWithRestartAsync(u, stoppingToken)));

        _logger.LogInformation("StreamingRiskWorker stopped");
    }

    // ── Per-user session ─────────────────────────────────────────────────────

    private async Task RunUserAsync(UserConfig user, CancellationToken ct)
    {
        _logger.LogInformation(
            "Starting streaming risk session for userId={UserId} broker={Broker}",
            user.UserId, user.BrokerType);

        var broker = _brokerFactory.Create(user.BrokerType, user.AccessToken, user.ApiKey);

        await using var portfolioStreamer  = broker.CreatePortfolioStreamer();
        await using var marketDataStreamer = broker.CreateMarketDataStreamer();

        try
        {
            // ── Initial position fetch ────────────────────────────────────────
            var positions = _cfg.FilterPositions(await broker.GetAllPositionsAsync(ct));
            _cache.UpdatePositions(user.UserId, positions);

            var tokens = _cache.GetOpenInstrumentTokens(user.UserId);

            // ── Connect streamers (token context needed for WebSocket auth) ───
            using (broker.UseToken())
            {
                await portfolioStreamer.ConnectAsync(null, ct);
                await marketDataStreamer.ConnectAsync(ct);

                if (tokens.Count > 0)
                {
                    _logger.LogInformation(
                        "Subscribing market data for {Count} instrument(s) — userId={UserId} broker={Broker}",
                        tokens.Count, user.UserId, user.BrokerType);
                    await marketDataStreamer.SubscribeAsync(tokens, FeedMode.Ltpc);
                }
            }

            _logger.LogInformation(
                "Streams connected for userId={UserId} broker={Broker}; monitoring {Count} open instrument(s)",
                user.UserId, user.BrokerType, _cache.GetOpenInstrumentTokens(user.UserId).Count);

            // ── Event handlers ───────────────────────────────────────────────
            portfolioStreamer.UpdateReceived += (_, update) =>
            {
                if (update.Type is not ("order_update" or "position_update")) return;
                _logger.LogDebug(
                    "Portfolio event received: {EventType} for userId={UserId} broker={Broker}",
                    update.Type, user.UserId, user.BrokerType);
                _ = Task.Run(() => HandlePortfolioUpdateAsync(user, broker, marketDataStreamer, ct));
            };

            marketDataStreamer.FeedReceived += (_, msg) =>
            {
                _ = Task.Run(() => HandleLtpTickAsync(user, broker, msg, ct));
            };

            portfolioStreamer.Reconnecting += (_, _) =>
                _logger.LogWarning("Portfolio stream reconnecting for userId={UserId} broker={Broker}", user.UserId, user.BrokerType);

            marketDataStreamer.Reconnecting += (_, _) =>
                _logger.LogWarning("Market data stream reconnecting for userId={UserId} broker={Broker}", user.UserId, user.BrokerType);

            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Streaming session failed for userId={UserId} broker={Broker}", user.UserId, user.BrokerType);
            throw;
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
                    "Restarting streaming session for userId={UserId} broker={Broker} in {Delay}s",
                    user.UserId, user.BrokerType, delaySeconds);

                try { await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct); }
                catch (OperationCanceledException) { return; }

                delaySeconds = Math.Min(delaySeconds * 2, maxDelaySeconds);
            }
        }
    }

    // ── Portfolio event handler ──────────────────────────────────────────────

    private async Task HandlePortfolioUpdateAsync(
        UserConfig user, IBrokerClient broker,
        IMarketDataStreamer marketDataStreamer, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Re-fetching positions after portfolio event for userId={UserId} broker={Broker}", user.UserId, user.BrokerType);

            var positions = _cfg.FilterPositions(await broker.GetAllPositionsAsync(ct));
            _cache.UpdatePositions(user.UserId, positions);

            var tokens = _cache.GetOpenInstrumentTokens(user.UserId);
            if (tokens.Count > 0)
            {
                _logger.LogDebug(
                    "Re-subscribing market data for {Count} instrument(s) — userId={UserId} broker={Broker}",
                    tokens.Count, user.UserId, user.BrokerType);
                using (broker.UseToken())
                    await marketDataStreamer.SubscribeAsync(tokens, FeedMode.Ltpc);
            }

            await EvaluateAsync(user, broker, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling portfolio update for userId={UserId} broker={Broker}", user.UserId, user.BrokerType);
        }
    }

    // ── LTP tick handler ─────────────────────────────────────────────────────

    private async Task HandleLtpTickAsync(
        UserConfig user, IBrokerClient broker, MarketDataMessage msg, CancellationToken ct)
    {
        foreach (var (token, feed) in msg.Instruments)
        {
            var ltp = feed.Ltpc?.Ltp ?? feed.Full?.Ltpc?.Ltp ?? feed.OptionGreeks?.Ltpc?.Ltp;
            if (ltp.HasValue)
                _cache.UpdateLtp(user.UserId, token, ltp.Value);
        }

        if (!CanEvaluateFromLtp(user.UserId))
        {
            _logger.LogDebug("LTP eval rate-limited for userId={UserId} broker={Broker} — skipping", user.UserId, user.BrokerType);
            return;
        }

        try
        {
            await EvaluateAsync(user, broker, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during LTP-triggered evaluation for userId={UserId} broker={Broker}", user.UserId, user.BrokerType);
        }
    }

    // ── Risk evaluation helper ───────────────────────────────────────────────

    private async Task EvaluateAsync(UserConfig user, IBrokerClient broker, CancellationToken ct)
    {
        if (!CheckTradingWindow())
        {
            _logger.LogDebug("Skipping evaluation for userId={UserId} broker={Broker} — outside trading hours", user.UserId, user.BrokerType);
            return;
        }

        var gate = _gates.GetOrAdd(user.UserId, _ => new UserGate());
        if (!await gate.Sem.WaitAsync(0, ct))
        {
            _logger.LogDebug("Evaluation already in progress for userId={UserId} broker={Broker} — skipping", user.UserId, user.BrokerType);
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
                    "Market open — risk engine active (window: {Start}–{End} {Tz})",
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
