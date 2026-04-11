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
            ApplyProperties(existing, config);
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
    }

    private static void ApplyProperties(UserRiskConfig target, UserRiskConfig source)
    {
        target.Enabled               = source.Enabled;
        target.MtmTarget             = source.MtmTarget;
        target.MtmSl                 = source.MtmSl;
        target.TrailingEnabled       = source.TrailingEnabled;
        target.TrailingActivateAt    = source.TrailingActivateAt;
        target.LockProfitAt          = source.LockProfitAt;
        target.IncreaseBy            = source.IncreaseBy;
        target.TrailBy               = source.TrailBy;
        target.AutoShiftEnabled      = source.AutoShiftEnabled;
        target.AutoShiftThresholdPct = source.AutoShiftThresholdPct;
        target.AutoShiftMaxCount     = source.AutoShiftMaxCount;
        target.AutoShiftStrikeGap    = source.AutoShiftStrikeGap;
        target.WatchedProducts       = source.WatchedProducts;
    }
}
