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
        _redis.GetSubscriber().Subscribe(RedisChannel.Literal("ltp:feed"), OnMessage);
        _logger.LogInformation("RedisLtpRelay: subscribed to Redis ltp:feed — will relay ticks to PositionStreamCoordinator");
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct)
    {
        _logger.LogInformation("RedisLtpRelay: unsubscribing from ltp:feed");
        _redis.GetSubscriber().Unsubscribe(RedisChannel.Literal("ltp:feed"));
        return Task.CompletedTask;
    }

    // Forwards subscription requests to MarketDataService in the Worker via ltp:sub-req.
    // MarketDataService listens on that channel and subscribes the tokens to the upstream WebSocket.
    public Task SubscribeAsync(IReadOnlyCollection<string> tokens, FeedMode mode = FeedMode.Ltpc, CancellationToken ct = default)
    {
        if (tokens.Count == 0) return Task.CompletedTask;
        _logger.LogInformation(
            "RedisLtpRelay: forwarding subscription request for {Count} instrument(s) to Worker via ltp:sub-req — {Tokens}",
            tokens.Count, string.Join(", ", tokens));
        var payload = JsonSerializer.Serialize(tokens);
        _redis.GetSubscriber().Publish(
            RedisChannel.Literal("ltp:sub-req"), payload, CommandFlags.FireAndForget);
        return Task.CompletedTask;
    }

    public Task UnsubscribeAsync(IReadOnlyCollection<string> tokens, CancellationToken ct = default)
        => Task.CompletedTask;

    private void OnMessage(RedisChannel channel, RedisValue value)
    {
        try
        {
            var ltps = JsonSerializer.Deserialize<Dictionary<string, decimal>>(value.ToString());
            if (ltps is null || ltps.Count == 0) return;
            _logger.LogDebug("RedisLtpRelay: received tick from ltp:feed — {Count} instrument(s)", ltps.Count);
            FeedReceived?.Invoke(this, new LtpUpdate(ltps));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "RedisLtpRelay: failed to deserialize LTP tick from Redis ltp:feed");
        }
    }
}
