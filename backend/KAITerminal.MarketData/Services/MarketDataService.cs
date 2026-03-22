using System.Text.Json;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Infrastructure.Services;
using KAITerminal.Upstox;
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
    private readonly Func<IMarketDataStreamer>   _streamerFactory;
    private readonly ILogger<MarketDataService> _logger;

    private IMarketDataStreamer? _streamer;
    private readonly SemaphoreSlim   _subLock    = new(1, 1);
    private readonly HashSet<string> _subscribed = new(StringComparer.Ordinal);
    private bool _disposed;

    public event EventHandler<LtpUpdate>? FeedReceived;

    public MarketDataService(
        IConnectionMultiplexer     redis,
        IServiceScopeFactory       scopeFactory,
        Func<IMarketDataStreamer>   streamerFactory,
        ILogger<MarketDataService> logger)
    {
        _redis           = redis;
        _scopeFactory    = scopeFactory;
        _streamerFactory = streamerFactory;
        _logger          = logger;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        var token = await FetchAnalyticsTokenAsync(ct);
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning(
                "No analytics token configured — market data feed is inactive. " +
                "Set the token via the Admin page.");
            return;
        }

        _streamer = _streamerFactory();
        _streamer.FeedReceived += OnFeedReceived!;

        using (UpstoxTokenContext.Use(token))
            await _streamer.ConnectAsync(ct);

        _logger.LogInformation("MarketDataService connected — shared market data feed active");
    }

    public async Task StopAsync(CancellationToken ct)
    {
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
            if (newTokens.Count == 0) return;
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
            // Intentionally not sending unsubscribe to the WebSocket —
            // other users may still need those ticks; consumers filter locally.
        }
        finally { _subLock.Release(); }
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
            _logger.LogWarning(ex, "Failed to publish LTP ticks to Redis");
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
