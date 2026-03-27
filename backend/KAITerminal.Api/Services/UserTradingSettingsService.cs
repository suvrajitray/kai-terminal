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
        IndexChangeMode: "prevClose");

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
            settings.IndexChangeMode);
    }

    public async Task SaveAsync(string username, SaveUserTradingSettingsRequest request)
    {
        var existing = await db.UserTradingSettings
            .FirstOrDefaultAsync(x => x.Username == username);

        if (existing is not null)
        {
            existing.NiftyShiftOffset = request.NiftyShiftOffset;
            existing.SensexShiftOffset = request.SensexShiftOffset;
            existing.BankniftyShiftOffset = request.BankniftyShiftOffset;
            existing.FinniftyShiftOffset = request.FinniftyShiftOffset;
            existing.BankexShiftOffset = request.BankexShiftOffset;
            existing.IndexChangeMode = request.IndexChangeMode;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.UserTradingSettings.Add(new UserTradingSettings
            {
                Username = username,
                NiftyShiftOffset = request.NiftyShiftOffset,
                SensexShiftOffset = request.SensexShiftOffset,
                BankniftyShiftOffset = request.BankniftyShiftOffset,
                FinniftyShiftOffset = request.FinniftyShiftOffset,
                BankexShiftOffset = request.BankexShiftOffset,
                IndexChangeMode = request.IndexChangeMode,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync();
    }
}
