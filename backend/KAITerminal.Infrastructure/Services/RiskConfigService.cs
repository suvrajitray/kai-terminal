using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Infrastructure.Services;

public interface IRiskConfigService
{
    Task<UserRiskConfig?> GetAsync(string username);
    Task UpsertAsync(string username, UserRiskConfig config);
}

public sealed class RiskConfigService(AppDbContext db) : IRiskConfigService
{
    public Task<UserRiskConfig?> GetAsync(string username) =>
        db.UserRiskConfigs.FirstOrDefaultAsync(r => r.Username == username);

    public async Task UpsertAsync(string username, UserRiskConfig config)
    {
        var existing = await db.UserRiskConfigs.FirstOrDefaultAsync(r => r.Username == username);
        if (existing is null)
        {
            config.Username  = username;
            config.UpdatedAt = DateTime.UtcNow;
            db.UserRiskConfigs.Add(config);
        }
        else
        {
            existing.Enabled            = config.Enabled;
            existing.MtmTarget          = config.MtmTarget;
            existing.MtmSl              = config.MtmSl;
            existing.TrailingEnabled    = config.TrailingEnabled;
            existing.TrailingActivateAt = config.TrailingActivateAt;
            existing.LockProfitAt       = config.LockProfitAt;
            existing.IncreaseBy         = config.IncreaseBy;
            existing.TrailBy            = config.TrailBy;
            existing.UpdatedAt          = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
    }
}
