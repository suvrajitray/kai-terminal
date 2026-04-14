using System.Collections.Concurrent;
using System.Text.Json;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using StackExchange.Redis;

namespace KAITerminal.RiskEngine.State;

/// <summary>
/// Redis-backed risk state store. Persists trailing SL state and the squared-off flag
/// across Worker restarts, preventing false re-entries after a crash.
/// Key pattern: <c>risk-state:{userId}</c>
/// </summary>
public sealed class RedisRiskRepository : IRiskRepository
{
    private readonly IConnectionMultiplexer _redis;
    private static readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    // One semaphore per stateKey — serialises all read/modify/write cycles for the same user
    // while letting different users proceed in parallel.
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public RedisRiskRepository(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task<UserRiskState> GetOrCreateAsync(string userId)
    {
        var db = _redis.GetDatabase();
        var value = await db.StringGetAsync(Key(userId));
        if (!value.HasValue) return new UserRiskState();
        try { return JsonSerializer.Deserialize<UserRiskState>((string)value!, _json) ?? new UserRiskState(); }
        catch { return new UserRiskState(); }
    }

    public async Task UpdateAsync(string userId, UserRiskState state)
    {
        var db = _redis.GetDatabase();
        await db.StringSetAsync(Key(userId), JsonSerializer.Serialize(state, _json));
    }

    public async Task ResetAsync(string userId)
    {
        var db = _redis.GetDatabase();
        await db.KeyDeleteAsync(Key(userId));
    }

    public async Task MutateAsync(string stateKey, Action<UserRiskState> mutate)
    {
        var sem = _locks.GetOrAdd(stateKey, _ => new SemaphoreSlim(1, 1));
        await sem.WaitAsync();
        try
        {
            var state = await GetOrCreateAsync(stateKey);
            mutate(state);
            await UpdateAsync(stateKey, state);
        }
        finally
        {
            sem.Release();
        }
    }

    private static string Key(string stateKey) => $"risk-state:{stateKey}";
}
