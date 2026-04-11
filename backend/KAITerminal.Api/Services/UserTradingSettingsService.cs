using KAITerminal.Api.Models;
using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Services;

public class UserTradingSettingsService(AppDbContext db)
{
    private static readonly UserTradingSettingsResponse Defaults = new(
        NiftyShiftOffset: 1,
        SensexShiftOffset: 1,
        BankniftyShiftOffset: 1,
        FinniftyShiftOffset: 1,
        BankexShiftOffset: 1,
        IndexChangeMode: "prevClose",
        AutoSquareOffEnabled: false,
        AutoSquareOffTime: "15:20");

    public async Task<UserTradingSettingsResponse> GetAsync(string username)
    {
        var settings = await db.UserTradingSettings
            .FirstOrDefaultAsync(x => x.Username == username);

        if (settings is null) return Defaults;

        return new UserTradingSettingsResponse(
            settings.NiftyShiftOffset,
            settings.SensexShiftOffset,
            settings.BankniftyShiftOffset,
            settings.FinniftyShiftOffset,
            settings.BankexShiftOffset,
            settings.IndexChangeMode,
            settings.AutoSquareOffEnabled,
            settings.AutoSquareOffTime);
    }

    public async Task SaveAsync(string username, SaveUserTradingSettingsRequest request)
    {
        var existing = await db.UserTradingSettings
            .FirstOrDefaultAsync(x => x.Username == username);

        if (existing is not null)
        {
            ApplyProperties(existing, request);
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            var entity = new UserTradingSettings { Username = username };
            ApplyProperties(entity, request);
            entity.UpdatedAt = DateTime.UtcNow;
            db.UserTradingSettings.Add(entity);
        }

        await db.SaveChangesAsync();
    }

    private static void ApplyProperties(UserTradingSettings entity, SaveUserTradingSettingsRequest req)
    {
        entity.NiftyShiftOffset     = req.NiftyShiftOffset;
        entity.SensexShiftOffset    = req.SensexShiftOffset;
        entity.BankniftyShiftOffset = req.BankniftyShiftOffset;
        entity.FinniftyShiftOffset  = req.FinniftyShiftOffset;
        entity.BankexShiftOffset    = req.BankexShiftOffset;
        entity.IndexChangeMode      = req.IndexChangeMode;
        entity.AutoSquareOffEnabled = req.AutoSquareOffEnabled;
        entity.AutoSquareOffTime    = req.AutoSquareOffTime;
    }
}
