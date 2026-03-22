using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace KAITerminal.Infrastructure.Services;

public interface IAppSettingService
{
    Task<string?> GetAsync(string key, CancellationToken ct = default);
    Task SetAsync(string key, string value, CancellationToken ct = default);
}

/// <summary>
/// Reads app settings from Redis (L1 cache) with automatic DB fallback.
/// Writes go to both DB and Redis so the cache stays consistent.
/// Redis key pattern: <c>appsetting:{key}</c>
/// </summary>
public sealed class AppSettingService(AppDbContext db, IServiceProvider sp) : IAppSettingService
{
    private static string RedisKey(string key) => $"appsetting:{key}";

    private IDatabase? Redis => sp.GetService<IConnectionMultiplexer>()?.GetDatabase();

    public async Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        // L1: Redis
        var redis = Redis;
        if (redis is not null)
        {
            var cached = await redis.StringGetAsync(RedisKey(key));
            if (cached.HasValue)
                return (string?)cached;
        }

        // L2: DB
        var setting = await db.AppSettings.FindAsync([key], ct);
        return setting?.Value;
    }

    public async Task SetAsync(string key, string value, CancellationToken ct = default)
    {
        // Persist to DB
        var setting = await db.AppSettings.FindAsync([key], ct);
        if (setting is null)
            db.AppSettings.Add(new AppSetting { Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
        else
        {
            setting.Value     = value;
            setting.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);

        // Sync to Redis
        var redis = Redis;
        if (redis is not null)
            await redis.StringSetAsync(RedisKey(key), value);
    }
}
