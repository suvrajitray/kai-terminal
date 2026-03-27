using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Infrastructure.Services;

public interface IRiskConfigService
{
    Task<UserRiskConfig?> GetAsync(string username, string brokerType);
    Task UpsertAsync(string username, string brokerType, UserRiskConfig config);
}

public sealed class RiskConfigService(AppDbContext db) : IRiskConfigService
{
    public Task<UserRiskConfig?> GetAsync(string username, string brokerType) =>
        db.UserRiskConfigs.FirstOrDefaultAsync(r => r.Username == username && r.BrokerType == brokerType);

    public async Task UpsertAsync(string username, string brokerType, UserRiskConfig config)
    {
        var existing = await db.UserRiskConfigs.FirstOrDefaultAsync(r => r.Username == username && r.BrokerType == brokerType);
        if (existing is null)
        {
            config.Username   = username;
            config.BrokerType = brokerType;
            config.UpdatedAt  = DateTime.UtcNow;
            db.UserRiskConfigs.Add(config);
        }
        else
        {
            existing.Enabled              = config.Enabled;
            existing.MtmTarget            = config.MtmTarget;
            existing.MtmSl                = config.MtmSl;
            existing.TrailingEnabled      = config.TrailingEnabled;
            existing.TrailingActivateAt   = config.TrailingActivateAt;
            existing.LockProfitAt         = config.LockProfitAt;
            existing.IncreaseBy           = config.IncreaseBy;
            existing.TrailBy              = config.TrailBy;
            existing.AutoShiftEnabled     = config.AutoShiftEnabled;
            existing.AutoShiftThresholdPct = config.AutoShiftThresholdPct;
            existing.AutoShiftMaxCount    = config.AutoShiftMaxCount;
            existing.AutoShiftStrikeGap   = config.AutoShiftStrikeGap;
            existing.UpdatedAt            = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
    }
}
