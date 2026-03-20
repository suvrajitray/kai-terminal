using System.Text.Json;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Upstox;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace KAITerminal.Api.Services;

/// <summary>
/// Owns a single Upstox market data WebSocket connection using admin credentials fetched from DB.
/// Publishes LTP ticks to Redis pub/sub channel <c>ltp:feed</c> for cross-process fan-out
/// and fires <see cref="FeedReceived"/> for in-process subscribers.
/// Registered as both <see cref="ISharedMarketDataService"/> and <see cref="IHostedService"/>.
/// </summary>
public sealed class AdminMarketDataService : ISharedMarketDataService, IHostedService, IAsyncDisposable
{
    private readonly IConnectionMultiplexer          _redis;
    private readonly IServiceScopeFactory            _scopeFactory;
    private readonly IConfiguration                  _config;
    private readonly Func<IMarketDataStreamer>        _streamerFactory;
    private readonly ILogger<AdminMarketDataService> _logger;

    private IMarketDataStreamer? _streamer;
    private readonly SemaphoreSlim _subLock    = new(1, 1);
    private readonly HashSet<string> _subscribed = new(StringComparer.Ordinal);
    private bool _disposed;

    public event EventHandler<LtpUpdate>? FeedReceived;

    public AdminMarketDataService(
        IConnectionMultiplexer          redis,
        IServiceScopeFactory            scopeFactory,
        IConfiguration                  config,
        Func<IMarketDataStreamer>        streamerFactory,
        ILogger<AdminMarketDataService> logger)
    {
        _redis           = redis;
        _scopeFactory    = scopeFactory;
        _config          = config;
        _streamerFactory = streamerFactory;
        _logger          = logger;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        var token = await FetchAdminTokenAsync(ct);
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning("No admin broker credentials found in DB — shared market data service is inactive");
            return;
        }

        _streamer = _streamerFactory();
        _streamer.FeedReceived += OnFeedReceived!;

        using (UpstoxTokenContext.Use(token))
            await _streamer.ConnectAsync(ct);

        _logger.LogInformation("AdminMarketDataService connected — shared market data feed active");
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
            // Note: intentionally not sending unsubscribe to the WebSocket —
            // other users may still need those ticks; consumers filter locally.
        }
        finally { _subLock.Release(); }
    }

    private async Task<string?> FetchAdminTokenAsync(CancellationToken ct)
    {
        var brokerType = _config["AdminBroker:BrokerType"] ?? "upstox";

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        return await db.BrokerCredentials
            .Join(db.Users, bc => bc.Username, u => u.Email, (bc, u) => bc)
            .Where(bc => bc.BrokerName == brokerType)
            .OrderByDescending(bc => bc.UpdatedAt)
            .Select(bc => bc.AccessToken)
            .FirstOrDefaultAsync(ct);
    }

    private void OnFeedReceived(object? sender, LtpUpdate update)
    {
        // Fire in-process event
        FeedReceived?.Invoke(this, update);

        // Publish to Redis for cross-process consumers (Worker)
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
