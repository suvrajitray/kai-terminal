using System.Collections.Concurrent;
using System.Diagnostics;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Services;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Workers;

/// <summary>
/// WebSocket-driven risk worker that replaces the two interval-based workers.
/// <para>
/// Per user: connects an Upstox Portfolio stream and a Market Data stream.
/// Portfolio events trigger a REST position re-fetch + full risk evaluation.
/// LTP ticks update the in-memory cache and trigger a rate-limited portfolio risk check
/// (no REST call — MTM is computed from the cache).
/// </para>
/// </summary>
public sealed class StreamingRiskWorker : BackgroundService
{
    private readonly IUserTokenSource _tokenSource;
    private readonly UpstoxClient _upstox;
    private readonly IPositionCache _cache;
    private readonly RiskEvaluator _evaluator;
    private readonly RiskEngineConfig _cfg;
    private readonly ILogger<StreamingRiskWorker> _logger;

    // Per-user evaluation gate: prevents concurrent evaluations and rate-limits LTP-triggered ones.
    private readonly ConcurrentDictionary<string, UserGate> _gates = new(StringComparer.Ordinal);

    private sealed class UserGate
    {
        public readonly SemaphoreSlim Sem = new(1, 1);
        public long LastLtpEvalTicks;   // Stopwatch ticks of last LTP-triggered evaluation
    }

    public StreamingRiskWorker(
        IUserTokenSource tokenSource,
        UpstoxClient upstox,
        IPositionCache cache,
        RiskEvaluator evaluator,
        IOptions<RiskEngineConfig> cfg,
        ILogger<StreamingRiskWorker> logger)
    {
        _tokenSource = tokenSource;
        _upstox = upstox;
        _cache = cache;
        _evaluator = evaluator;
        _cfg = cfg.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("StreamingRiskWorker started");

        var users = await _tokenSource.GetUsersAsync(stoppingToken);
        if (!users.Any())
        {
            _logger.LogWarning("StreamingRiskWorker: no users configured — nothing to monitor");
            return;
        }

        await Task.WhenAll(users.Select(u => RunUserAsync(u, stoppingToken)));

        _logger.LogInformation("StreamingRiskWorker stopped");
    }

    // ── Per-user session ─────────────────────────────────────────────────────

    private async Task RunUserAsync(UserConfig user, CancellationToken ct)
    {
        _logger.LogInformation("Starting streaming risk session for userId={UserId}", user.UserId);

        await using var portfolioStreamer = _upstox.CreatePortfolioStreamer();
        await using var marketDataStreamer = _upstox.CreateMarketDataStreamer();

        try
        {
            // ── Initial position fetch & market data subscription ─────────────
            using (UpstoxTokenContext.Use(user.AccessToken))
            {
                var positions = _cfg.FilterPositions(await _upstox.GetAllPositionsAsync(ct));
                _cache.UpdatePositions(user.UserId, positions);

                var tokens = _cache.GetOpenInstrumentTokens(user.UserId);

                await portfolioStreamer.ConnectAsync(null, ct);
                await marketDataStreamer.ConnectAsync(ct);

                if (tokens.Count > 0)
                    await marketDataStreamer.SubscribeAsync(tokens, FeedMode.Ltpc);
            }

            _logger.LogInformation(
                "Streams connected for userId={UserId}; monitoring {Count} instrument(s)",
                user.UserId, _cache.GetOpenInstrumentTokens(user.UserId).Count);

            // ── Event handlers ───────────────────────────────────────────────
            portfolioStreamer.UpdateReceived += (_, update) =>
            {
                if (update.Type is not ("order_update" or "position_update")) return;
                _ = Task.Run(() => HandlePortfolioUpdateAsync(user, marketDataStreamer, ct));
            };

            marketDataStreamer.FeedReceived += (_, msg) =>
            {
                _ = Task.Run(() => HandleLtpTickAsync(user, msg, ct));
            };

            portfolioStreamer.Reconnecting += (_, _) =>
                _logger.LogWarning("Portfolio stream reconnecting for userId={UserId}", user.UserId);

            marketDataStreamer.Reconnecting += (_, _) =>
                _logger.LogWarning("Market data stream reconnecting for userId={UserId}", user.UserId);

            // Keep session alive until host shuts down
            await Task.Delay(Timeout.InfiniteTimeSpan, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Normal shutdown — streamers disposed by await using
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error in streaming session for userId={UserId}", user.UserId);
        }
    }

    // ── Portfolio event handler ──────────────────────────────────────────────

    private async Task HandlePortfolioUpdateAsync(
        UserConfig user, IMarketDataStreamer marketDataStreamer, CancellationToken ct)
    {
        try
        {
            IReadOnlyList<Upstox.Models.Responses.Position> positions;
            using (UpstoxTokenContext.Use(user.AccessToken))
                positions = _cfg.FilterPositions(await _upstox.GetAllPositionsAsync(ct));

            _cache.UpdatePositions(user.UserId, positions);

            // Re-subscribe market data for any new instruments
            var tokens = _cache.GetOpenInstrumentTokens(user.UserId);
            if (tokens.Count > 0)
                using (UpstoxTokenContext.Use(user.AccessToken))
                    await marketDataStreamer.SubscribeAsync(tokens, FeedMode.Ltpc);

            using (UpstoxTokenContext.Use(user.AccessToken))
                await EvaluateAsync(user, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling portfolio update for userId={UserId}", user.UserId);
        }
    }

    // ── LTP tick handler ─────────────────────────────────────────────────────

    private async Task HandleLtpTickAsync(UserConfig user, MarketDataMessage msg, CancellationToken ct)
    {
        // Update LTP cache from tick
        foreach (var (token, feed) in msg.Instruments)
        {
            var ltp = feed.Ltpc?.Ltp ?? feed.Full?.Ltpc?.Ltp ?? feed.OptionGreeks?.Ltpc?.Ltp;
            if (ltp.HasValue)
                _cache.UpdateLtp(user.UserId, token, ltp.Value);
        }

        // Rate-limit: skip evaluation if last one was within the configured interval
        if (!CanEvaluateFromLtp(user.UserId)) return;

        try
        {
            using (UpstoxTokenContext.Use(user.AccessToken))
                await EvaluateAsync(user, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during LTP-triggered evaluation for userId={UserId}", user.UserId);
        }
    }

    // ── Risk evaluation helper ───────────────────────────────────────────────

    private async Task EvaluateAsync(UserConfig user, CancellationToken ct)
    {
        var gate = _gates.GetOrAdd(user.UserId, _ => new UserGate());
        if (!await gate.Sem.WaitAsync(0, ct)) return; // skip if already evaluating
        try
        {
            var mtm = _cache.GetMtm(user.UserId);
            await _evaluator.EvaluateAsync(user.UserId, mtm, user, ct);
        }
        finally
        {
            gate.Sem.Release();
        }
    }

    private bool CanEvaluateFromLtp(string userId)
    {
        var gate = _gates.GetOrAdd(userId, _ => new UserGate());
        var now = Stopwatch.GetTimestamp();
        var minInterval = (long)(_cfg.LtpEvalMinIntervalMs / 1000.0 * Stopwatch.Frequency);
        var last = Volatile.Read(ref gate.LastLtpEvalTicks);

        if (now - last < minInterval) return false;

        // CAS to claim the slot — only one concurrent caller proceeds
        return Interlocked.CompareExchange(ref gate.LastLtpEvalTicks, now, last) == last;
    }
}
