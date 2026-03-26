using System.Text.Json;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace KAITerminal.MarketData.Services;

/// <summary>
/// Owns the single Upstox market data WebSocket connection using the long-lived analytics token
/// stored in AppSettings (valid for 1 year — no daily rotation required).
/// Publishes LTP ticks to Redis pub/sub channel <c>ltp:feed</c> for cross-process fan-out
/// and fires <see cref="FeedReceived"/> for in-process subscribers (e.g. StreamingRiskWorker).
/// </summary>
public sealed class MarketDataService : ISharedMarketDataService, IHostedService, IAsyncDisposable
{
    private readonly IConnectionMultiplexer     _redis;
    private readonly IServiceScopeFactory       _scopeFactory;
    private readonly Func<string, IMarketDataStreamer> _streamerFactory;
    private readonly ILogger<MarketDataService> _logger;

    private IMarketDataStreamer? _streamer;
    private readonly SemaphoreSlim   _subLock    = new(1, 1);
    private readonly HashSet<string> _subscribed = new(StringComparer.Ordinal);
    private bool _disposed;

    public event EventHandler<LtpUpdate>? FeedReceived;

    public MarketDataService(
        IConnectionMultiplexer          redis,
        IServiceScopeFactory            scopeFactory,
        Func<string, IMarketDataStreamer> streamerFactory,
        ILogger<MarketDataService>      logger)
    {
        _redis           = redis;
        _scopeFactory    = scopeFactory;
        _streamerFactory = streamerFactory;
        _logger          = logger;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        _logger.LogInformation("MarketDataService starting — fetching analytics token from AppSettings");

        var token = await FetchAnalyticsTokenAsync(ct);
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning(
                "MarketDataService: no analytics token configured — market data feed is inactive. " +
                "Go to Admin page → set the Upstox Analytics Token → restart Worker.");
            return;
        }

        _logger.LogInformation("MarketDataService: analytics token found — connecting Upstox market data WebSocket");

        _streamer = _streamerFactory(token);
        _streamer.FeedReceived += OnFeedReceived!;
        await _streamer.ConnectAsync(ct);

        // Listen for subscription requests from the Api process (PositionStreamCoordinator)
        // so live LTP works regardless of whether the risk engine is enabled for a user.
        _redis.GetSubscriber().Subscribe(
            RedisChannel.Literal("ltp:sub-req"), OnSubRequest);

        _logger.LogInformation(
            "MarketDataService ready — WebSocket connected, listening on ltp:sub-req for instrument subscriptions");
    }

    public async Task StopAsync(CancellationToken ct)
    {
        _logger.LogInformation("MarketDataService stopping");
        _redis.GetSubscriber().Unsubscribe(RedisChannel.Literal("ltp:sub-req"));
        if (_streamer is not null)
            await _streamer.DisposeAsync();
    }

    public async Task SubscribeAsync(IReadOnlyCollection<string> tokens, FeedMode mode = FeedMode.Ltpc, CancellationToken ct = default)
    {
        if (_streamer is null || tokens.Count == 0) return;

        await _subLock.WaitAsync(ct);
        try
        {
            var newTokens = tokens.Where(t => _subscribed.Add(t)).ToList();
            if (newTokens.Count == 0)
            {
                _logger.LogDebug(
                    "MarketDataService: subscription request for {Count} token(s) — all already subscribed, skipping",
                    tokens.Count);
                return;
            }

            _logger.LogInformation(
                "MarketDataService: subscribing {New} new instrument(s) to WebSocket (total subscribed: {Total}) — {Tokens}",
                newTokens.Count, _subscribed.Count, string.Join(", ", newTokens));

            await _streamer.SubscribeAsync(newTokens, mode);
        }
        finally { _subLock.Release(); }
    }

    public async Task UnsubscribeAsync(IReadOnlyCollection<string> tokens, CancellationToken ct = default)
    {
        if (tokens.Count == 0) return;

        await _subLock.WaitAsync(ct);
        try
        {
            foreach (var t in tokens)
                _subscribed.Remove(t);
            // Intentionally not unsubscribing from the WebSocket —
            // other users may still need those ticks; consumers filter locally.
            _logger.LogDebug(
                "MarketDataService: removed {Count} token(s) from local tracking (WebSocket sub retained)",
                tokens.Count);
        }
        finally { _subLock.Release(); }
    }

    private void OnSubRequest(RedisChannel _, RedisValue value)
    {
        try
        {
            var tokens = JsonSerializer.Deserialize<List<string>>(value.ToString());
            if (tokens is null || tokens.Count == 0) return;

            _logger.LogInformation(
                "MarketDataService: received subscription request from API for {Count} instrument(s) — forwarding to WebSocket",
                tokens.Count);

            var subTask = SubscribeAsync(tokens).ContinueWith(
                t => _logger.LogWarning(t.Exception, "MarketDataService: failed to subscribe instruments from API request"),
                TaskContinuationOptions.OnlyOnFaulted);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MarketDataService: failed to deserialize subscription request from Redis");
        }
    }

    private async Task<string?> FetchAnalyticsTokenAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var svc = scope.ServiceProvider.GetRequiredService<IAppSettingService>();
        return await svc.GetAsync(AppSettingKeys.UpstoxAnalyticsToken, ct);
    }

    private void OnFeedReceived(object? sender, LtpUpdate update)
    {
        // Fire in-process event (picked up by StreamingRiskWorker)
        FeedReceived?.Invoke(this, update);

        // Publish to Redis for cross-process consumers (Api / PositionStreamCoordinator)
        try
        {
            var pub     = _redis.GetSubscriber();
            var payload = JsonSerializer.Serialize(update.Ltps);
            pub.Publish(RedisChannel.Literal("ltp:feed"), payload, CommandFlags.FireAndForget);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MarketDataService: failed to publish LTP tick to Redis ltp:feed");
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;
        if (_streamer is not null)
        {
            _streamer.FeedReceived -= OnFeedReceived!;
            await _streamer.DisposeAsync();
        }
        _subLock.Dispose();
    }
}
