using KAITerminal.Api.Data;
using KAITerminal.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Services;

public class BrokerCredentialService(AppDbContext db)
{
    public async Task<List<BrokerCredentialResponse>> GetAsync(string username) =>
        await db.BrokerCredentials
            .Where(x => x.Username == username)
            .Select(x => new BrokerCredentialResponse(x.BrokerName, x.ApiKey, x.ApiSecret))
            .ToListAsync();

    public async Task UpsertAsync(string username, SaveBrokerCredentialRequest request)
    {
        var existing = await db.BrokerCredentials
            .FirstOrDefaultAsync(x => x.Username == username && x.BrokerName == request.BrokerName);

        if (existing is not null)
        {
            existing.ApiKey = request.ApiKey;
            existing.ApiSecret = request.ApiSecret;
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
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }

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
