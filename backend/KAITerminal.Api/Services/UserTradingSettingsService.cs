using KAITerminal.Api.Models;
using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Services;

public class UserTradingSettingsService(AppDbContext db)
{
    private static readonly UserTradingSettingsResponse Defaults = new(
        DefaultStoplossPercentage: 30m,
        NiftyShiftOffset: 5,
        SensexShiftOffset: 10,
        BankniftyShiftOffset: 10,
        FinniftyShiftOffset: 5,
        BankexShiftOffset: 10,
        IndexChangeMode: "prevClose");

    public async Task<UserTradingSettingsResponse> GetAsync(string username)
    {
        var settings = await db.UserTradingSettings
            .FirstOrDefaultAsync(x => x.Username == username);

        if (settings is null) return Defaults;

        return new UserTradingSettingsResponse(
            settings.DefaultStoplossPercentage,
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
            existing.DefaultStoplossPercentage = request.DefaultStoplossPercentage;
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
                DefaultStoplossPercentage = request.DefaultStoplossPercentage,
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
