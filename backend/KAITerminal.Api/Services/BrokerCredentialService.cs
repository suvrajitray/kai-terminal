using System.Text;
using System.Text.Json;
using KAITerminal.Contracts;
using KAITerminal.Infrastructure.Data;
using KAITerminal.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace KAITerminal.Api.Services;

public class BrokerCredentialService(
    AppDbContext db,
    IMemoryCache cache,
    BrokerCredentialCacheInvalidator cacheInvalidator)
{
    // Cache keys
    private static string ApiKeyLookupKey(string brokerName, string apiKey) => $"brokercred:{brokerName}:apikey:{apiKey}";

    private MemoryCacheEntryOptions CacheOptions() =>
        new MemoryCacheEntryOptions()
            .AddExpirationToken(cacheInvalidator.GetChangeToken())
            .SetAbsoluteExpiration(TimeSpan.FromHours(7)); // safety net covers full trading session; primary eviction is the cancellation token on write

    private void InvalidateCache() => cacheInvalidator.Invalidate();

    // ── Public read methods ───────────────────────────────────────────────────

    public async Task<List<BrokerCredentialResponse>> GetAsync(string username)
    {
        var istOffset = TimeSpan.FromHours(5.5);
        var todayIst  = (DateTime.UtcNow + istOffset).Date;
        var cutoffUtc = todayIst + TimeSpan.FromHours(8) - istOffset; // 8 AM IST → UTC

        var rows = await db.BrokerCredentials
            .Where(x => x.Username == username)
            .ToListAsync();

        return rows.Select(x =>
        {
            var token = x.AccessToken;
            if (string.IsNullOrEmpty(token) || token == "NA" || x.UpdatedAt < cutoffUtc)
                token = "";
            // Upstox issues JWTs — also verify the token hasn't expired mid-day
            if (token != "" && x.BrokerName == BrokerNames.Upstox && IsJwtExpired(token))
                token = "";
            return new BrokerCredentialResponse(x.BrokerName, x.ApiKey, x.ApiSecret, token);
        }).ToList();
    }

    private static bool IsJwtExpired(string token)
    {
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 3) return true;
            var padded = parts[1].Replace('-', '+').Replace('_', '/');
            padded += (padded.Length % 4) switch { 2 => "==", 3 => "=", _ => "" };
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(padded));
            var payload = JsonSerializer.Deserialize<JsonElement>(json);
            return !payload.TryGetProperty("exp", out var exp)
                || DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= exp.GetInt64();
        }
        catch { return true; }
    }

    // ── Webhook-optimised cache-first lookups ─────────────────────────────────

    /// <summary>
    /// Returns the credential for <paramref name="brokerName"/> matching <paramref name="apiKey"/>, or null.
    /// Used by both Zerodha and Upstox webhook handlers — same pattern, same cache.
    /// Result is cached — cache is invalidated on any write.
    /// </summary>
    public async Task<BrokerCredential?> FindByApiKeyAsync(string brokerName, string apiKey)
    {
        var key = ApiKeyLookupKey(brokerName, apiKey);
        if (cache.TryGetValue(key, out BrokerCredential? cached))
            return cached;

        var cred = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.BrokerName == brokerName && x.ApiKey == apiKey);

        cache.Set(key, cred, CacheOptions());
        return cred;
    }

    // ── Write methods (all invalidate cache) ──────────────────────────────────

    public async Task UpsertAsync(string username, SaveBrokerCredentialRequest request)
    {
        var existing = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.Username == username && x.BrokerName == request.BrokerName);

        var accessToken = string.IsNullOrEmpty(request.AccessToken) ? "NA" : request.AccessToken;

        if (existing is not null)
        {
            ApplyProperties(existing, request.ApiKey, request.ApiSecret, accessToken);
        }
        else
        {
            var entity = new BrokerCredential
            {
                Username   = username,
                BrokerName = request.BrokerName,
                CreatedAt  = DateTime.UtcNow,
            };
            ApplyProperties(entity, request.ApiKey, request.ApiSecret, accessToken);
            db.BrokerCredentials.Add(entity);
        }

        await db.SaveChangesAsync();
        InvalidateCache();
    }

    private static void ApplyProperties(BrokerCredential entity, string apiKey, string apiSecret, string accessToken)
    {
        entity.ApiKey      = apiKey;
        entity.ApiSecret   = apiSecret;
        entity.AccessToken = accessToken;
        entity.UpdatedAt   = DateTime.UtcNow;
    }

    public async Task UpdateAccessTokenAsync(string username, string brokerName, string accessToken)
    {
        var credential = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.Username == username && x.BrokerName == brokerName);

        if (credential is null) return;

        credential.AccessToken = accessToken;
        credential.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        InvalidateCache();
    }

    public async Task UpdateBrokerUserIdAsync(string username, string brokerName, string brokerUserId)
    {
        var cred = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.Username == username && x.BrokerName == brokerName);
        if (cred is null) return;
        cred.BrokerUserId = brokerUserId;
        cred.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        InvalidateCache();
    }

    public async Task<bool> DeleteAsync(string username, string brokerName)
    {
        var credential = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.Username == username && x.BrokerName == brokerName);

        if (credential is null) return false;

        db.BrokerCredentials.Remove(credential);
        await db.SaveChangesAsync();
        InvalidateCache();
        return true;
    }
}
