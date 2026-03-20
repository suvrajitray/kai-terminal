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

    public RedisRiskRepository(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public UserRiskState GetOrCreate(string userId)
    {
        var db = _redis.GetDatabase();
        var value = db.StringGet(Key(userId));
        if (!value.HasValue) return new UserRiskState();
        try { return JsonSerializer.Deserialize<UserRiskState>((string)value!, _json) ?? new UserRiskState(); }
        catch { return new UserRiskState(); }
    }

    public void Update(string userId, UserRiskState state)
    {
        var db = _redis.GetDatabase();
        db.StringSet(Key(userId), JsonSerializer.Serialize(state, _json));
    }

    public void Reset(string userId)
    {
        var db = _redis.GetDatabase();
        db.KeyDelete(Key(userId));
    }

    private static string Key(string userId) => $"risk-state:{userId}";
}
