using KAITerminal.Infrastructure.Data;
using KAITerminal.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Services;

public class BrokerCredentialService(AppDbContext db)
{
    public async Task<List<BrokerCredentialResponse>> GetAsync(string username) =>
        await db.BrokerCredentials
            .Where(x => x.Username == username)
            .Select(x => new BrokerCredentialResponse(x.BrokerName, x.ApiKey, x.ApiSecret, string.IsNullOrEmpty(x.AccessToken) ? "NA" : x.AccessToken))
            .ToListAsync();

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
    }

    public async Task UpdateAccessTokenAsync(string username, string brokerName, string accessToken)
    {
        var credential = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.Username == username && x.BrokerName == brokerName);

        if (credential is null) return;

        credential.AccessToken = accessToken;
        credential.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    public async Task<bool> DeleteAsync(string username, string brokerName)
    {
        var credential = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.Username == username && x.BrokerName == brokerName);

        if (credential is null) return false;

        db.BrokerCredentials.Remove(credential);
        await db.SaveChangesAsync();
        return true;
    }
}
