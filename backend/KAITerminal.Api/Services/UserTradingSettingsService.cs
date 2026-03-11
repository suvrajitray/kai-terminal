using KAITerminal.Api.Models;
using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Services;

public class UserTradingSettingsService(AppDbContext db)
{
    private static readonly UserTradingSettingsResponse Defaults = new(
        DefaultStoplossPercentage: 30m,
        NiftyShiftOffset: 5,
        BankniftyShiftOffset: 10,
        MidcpniftyShiftOffset: 10,
        FinniftyShiftOffset: 10,
        SensexShiftOffset: 10,
        BankexShiftOffset: 10);

    public async Task<UserTradingSettingsResponse> GetAsync(string username)
    {
        var settings = await db.UserTradingSettings
            .FirstOrDefaultAsync(x => x.Username == username);

        if (settings is null) return Defaults;

        return new UserTradingSettingsResponse(
            settings.DefaultStoplossPercentage,
            settings.NiftyShiftOffset,
            settings.BankniftyShiftOffset,
            settings.MidcpniftyShiftOffset,
            settings.FinniftyShiftOffset,
            settings.SensexShiftOffset,
            settings.BankexShiftOffset);
    }

    public async Task SaveAsync(string username, SaveUserTradingSettingsRequest request)
    {
        var existing = await db.UserTradingSettings
            .FirstOrDefaultAsync(x => x.Username == username);

        if (existing is not null)
        {
            existing.DefaultStoplossPercentage = request.DefaultStoplossPercentage;
            existing.NiftyShiftOffset = request.NiftyShiftOffset;
            existing.BankniftyShiftOffset = request.BankniftyShiftOffset;
            existing.MidcpniftyShiftOffset = request.MidcpniftyShiftOffset;
            existing.FinniftyShiftOffset = request.FinniftyShiftOffset;
            existing.SensexShiftOffset = request.SensexShiftOffset;
            existing.BankexShiftOffset = request.BankexShiftOffset;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.UserTradingSettings.Add(new UserTradingSettings
            {
                Username = username,
                DefaultStoplossPercentage = request.DefaultStoplossPercentage,
                NiftyShiftOffset = request.NiftyShiftOffset,
                BankniftyShiftOffset = request.BankniftyShiftOffset,
                MidcpniftyShiftOffset = request.MidcpniftyShiftOffset,
                FinniftyShiftOffset = request.FinniftyShiftOffset,
                SensexShiftOffset = request.SensexShiftOffset,
                BankexShiftOffset = request.BankexShiftOffset,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync();
    }
}
