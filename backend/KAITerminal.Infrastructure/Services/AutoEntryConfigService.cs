using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Infrastructure.Services;

public class AutoEntryConfigService(AppDbContext db) : IAutoEntryConfigService
{
    public Task<List<AutoEntryConfig>> GetAllForUserAsync(string username, CancellationToken ct = default) =>
        db.AutoEntryConfigs.Where(x => x.Username == username).OrderBy(x => x.CreatedAt).ToListAsync(ct);

    public Task<AutoEntryConfig?> GetByIdAsync(int id, string username, CancellationToken ct = default) =>
        db.AutoEntryConfigs.FirstOrDefaultAsync(x => x.Id == id && x.Username == username, ct);

    public async Task<AutoEntryConfig> CreateAsync(string username, AutoEntryConfig template, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var entity = new AutoEntryConfig
        {
            Username        = username,
            BrokerType      = template.BrokerType,
            Name            = template.Name,
            Enabled         = template.Enabled,
            Instrument      = template.Instrument,
            OptionType      = template.OptionType,
            Lots            = template.Lots,
            EntryAfterTime   = template.EntryAfterTime,
            NoEntryAfterTime = template.NoEntryAfterTime,
            TradingDays      = template.TradingDays,
            ExcludeExpiryDay = template.ExcludeExpiryDay,
            ExpiryOffset    = template.ExpiryOffset,
            StrikeMode      = template.StrikeMode,
            StrikeParam     = template.StrikeParam,
            CreatedAt       = now,
            UpdatedAt       = now,
        };
        db.AutoEntryConfigs.Add(entity);
        await db.SaveChangesAsync(ct);
        return entity;
    }

    public async Task<AutoEntryConfig?> UpdateAsync(int id, string username, AutoEntryConfig patch, CancellationToken ct = default)
    {
        var entity = await db.AutoEntryConfigs.FirstOrDefaultAsync(x => x.Id == id && x.Username == username, ct);
        if (entity is null) return null;

        entity.BrokerType      = patch.BrokerType;
        entity.Name            = patch.Name;
        entity.Enabled         = patch.Enabled;
        entity.Instrument      = patch.Instrument;
        entity.OptionType      = patch.OptionType;
        entity.Lots            = patch.Lots;
        entity.EntryAfterTime   = patch.EntryAfterTime;
        entity.NoEntryAfterTime = patch.NoEntryAfterTime;
        entity.TradingDays      = patch.TradingDays;
        entity.ExcludeExpiryDay = patch.ExcludeExpiryDay;
        entity.ExpiryOffset    = patch.ExpiryOffset;
        entity.StrikeMode      = patch.StrikeMode;
        entity.StrikeParam     = patch.StrikeParam;
        entity.UpdatedAt       = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        return entity;
    }

    public async Task<bool> DeleteAsync(int id, string username, CancellationToken ct = default)
    {
        var entity = await db.AutoEntryConfigs.FirstOrDefaultAsync(x => x.Id == id && x.Username == username, ct);
        if (entity is null) return false;
        db.AutoEntryConfigs.Remove(entity);
        await db.SaveChangesAsync(ct);
        return true;
    }

    public Task<List<AutoEntryConfig>> GetAllEnabledAsync(CancellationToken ct = default) =>
        db.AutoEntryConfigs.Where(x => x.Enabled).ToListAsync(ct);

    public Task<bool> HasEnteredTodayAsync(int strategyId, string todayIst, CancellationToken ct = default) =>
        db.AutoEntryLogs.AnyAsync(x => x.StrategyId == strategyId && x.TradeDateIst == todayIst, ct);

    public async Task LogEntryAsync(int strategyId, string instrument, string todayIst, DateTime enteredAtUtc, CancellationToken ct = default)
    {
        db.AutoEntryLogs.Add(new AutoEntryLog
        {
            StrategyId   = strategyId,
            Instrument   = instrument,
            TradeDateIst = todayIst,
            EnteredAtUtc = enteredAtUtc,
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task<List<AutoEntryLog>> GetTodayLogsForUserAsync(string username, string todayIst, CancellationToken ct = default)
    {
        var strategyIds = await db.AutoEntryConfigs
            .Where(x => x.Username == username)
            .Select(x => x.Id)
            .ToListAsync(ct);

        return await db.AutoEntryLogs
            .Where(x => strategyIds.Contains(x.StrategyId) && x.TradeDateIst == todayIst)
            .ToListAsync(ct);
    }
}
