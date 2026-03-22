using System.Text.Json;
using KAITerminal.Contracts.Streaming;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace KAITerminal.MarketData.Services;

/// <summary>
/// Subscribes to the Redis <c>ltp:feed</c> channel published by <see cref="MarketDataService"/>
/// and re-fires <see cref="FeedReceived"/> for in-process consumers (e.g. PositionStreamCoordinator).
/// Used in the Api process where <see cref="MarketDataService"/> is not hosted.
/// </summary>
public sealed class RedisLtpRelay : ISharedMarketDataService, IHostedService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<RedisLtpRelay> _logger;

    public event EventHandler<LtpUpdate>? FeedReceived;

    public RedisLtpRelay(IConnectionMultiplexer redis, ILogger<RedisLtpRelay> logger)
    {
        _redis  = redis;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken ct)
    {
        var sub = _redis.GetSubscriber();
        sub.Subscribe(RedisChannel.Literal("ltp:feed"), OnMessage);
        _logger.LogInformation("RedisLtpRelay subscribed to ltp:feed channel");
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct)
    {
        _redis.GetSubscriber().Unsubscribe(RedisChannel.Literal("ltp:feed"));
        return Task.CompletedTask;
    }

    // SubscribeAsync / UnsubscribeAsync are no-ops — subscription management is done
    // by MarketDataService in the Worker process which owns the upstream connection.
    public Task SubscribeAsync(IReadOnlyCollection<string> tokens, FeedMode mode = FeedMode.Ltpc, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task UnsubscribeAsync(IReadOnlyCollection<string> tokens, CancellationToken ct = default)
        => Task.CompletedTask;

    private void OnMessage(RedisChannel channel, RedisValue value)
    {
        try
        {
            var ltps = JsonSerializer.Deserialize<Dictionary<string, decimal>>(value.ToString());
            if (ltps is null || ltps.Count == 0) return;
            FeedReceived?.Invoke(this, new LtpUpdate(ltps));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to deserialize LTP tick from Redis");
        }
    }
}
