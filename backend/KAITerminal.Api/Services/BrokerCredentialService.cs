using KAITerminal.Infrastructure.Data;
using KAITerminal.Api.Models;
using KAITerminal.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace KAITerminal.Api.Services;

public class BrokerCredentialService(
    AppDbContext db,
    IMemoryCache cache,
    BrokerCredentialCacheInvalidator cacheInvalidator)
{
    // Cache keys
    private static string ZerodhaApiKeyKey(string apiKey)  => $"brokercred:zerodha:apikey:{apiKey}";
    private static string UpstoxSecretKey()                 => "brokercred:upstox:secret";
    private static string UpstoxUserIdKey(string userId)    => $"brokercred:upstox:userid:{userId}";

    private MemoryCacheEntryOptions CacheOptions() =>
        new MemoryCacheEntryOptions()
            .AddExpirationToken(cacheInvalidator.GetChangeToken())
            .SetAbsoluteExpiration(TimeSpan.FromHours(7)); // safety net covers full trading session; primary eviction is the cancellation token on write

    private void InvalidateCache() => cacheInvalidator.Invalidate();

    // ── Public read methods ───────────────────────────────────────────────────

    public async Task<List<BrokerCredentialResponse>> GetAsync(string username) =>
        await db.BrokerCredentials
            .Where(x => x.Username == username)
            .Select(x => new BrokerCredentialResponse(x.BrokerName, x.ApiKey, x.ApiSecret, string.IsNullOrEmpty(x.AccessToken) ? "NA" : x.AccessToken))
            .ToListAsync();

    // ── Webhook-optimised cache-first lookups ─────────────────────────────────

    /// <summary>
    /// Returns the Zerodha credential matching <paramref name="apiKey"/>, or null.
    /// Result is cached — cache is invalidated on any write.
    /// </summary>
    public async Task<BrokerCredential?> FindByZerodhaApiKeyAsync(string apiKey)
    {
        var key = ZerodhaApiKeyKey(apiKey);
        if (cache.TryGetValue(key, out BrokerCredential? cached))
            return cached;

        var cred = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.BrokerName == BrokerNames.Zerodha && x.ApiKey == apiKey);

        cache.Set(key, cred, CacheOptions());
        return cred;
    }

    /// <summary>
    /// Returns any Upstox credential that has a non-empty ApiSecret (shared across all users).
    /// Result is cached — cache is invalidated on any write.
    /// </summary>
    public async Task<BrokerCredential?> FindUpstoxSecretAsync()
    {
        var key = UpstoxSecretKey();
        if (cache.TryGetValue(key, out BrokerCredential? cached))
            return cached;

        var cred = await db.BrokerCredentials
            .Where(x => x.BrokerName == BrokerNames.Upstox && x.ApiSecret != "")
            .FirstOrDefaultAsync();

        cache.Set(key, cred, CacheOptions());
        return cred;
    }

    /// <summary>
    /// Returns the KAI username for the given Upstox <paramref name="brokerUserId"/>, or null.
    /// Result is cached — cache is invalidated on any write.
    /// </summary>
    public async Task<string?> FindUsernameByUpstoxUserIdAsync(string brokerUserId)
    {
        var key = UpstoxUserIdKey(brokerUserId);
        if (cache.TryGetValue(key, out string? cached))
            return cached;

        var username = await db.BrokerCredentials
            .Where(x => x.BrokerName == BrokerNames.Upstox && x.BrokerUserId == brokerUserId)
            .Select(x => x.Username)
            .FirstOrDefaultAsync();

        cache.Set(key, username, CacheOptions());
        return username;
    }

    // ── Write methods (all invalidate cache) ──────────────────────────────────

    public async Task UpsertAsync(string username, SaveBrokerCredentialRequest request)
    {
        var existing = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.Username == username && x.BrokerName == request.BrokerName);

        var accessToken = string.IsNullOrEmpty(request.AccessToken) ? "NA" : request.AccessToken;

        if (existing is not null)
        {
            existing.ApiKey = request.ApiKey;
            existing.ApiSecret = request.ApiSecret;
            existing.AccessToken = accessToken;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.BrokerCredentials.Add(new BrokerCredential
            {
                Username = username,
                BrokerName = request.BrokerName,
                ApiKey = request.ApiKey,
                ApiSecret = request.ApiSecret,
                AccessToken = accessToken,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync();
        InvalidateCache();
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
