using KAITerminal.Infrastructure;
using KAITerminal.Infrastructure.Data;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.Worker;

/// <summary>
/// Reads enabled users and their risk configs from the database on every call.
/// Joins on (Username, BrokerType) so one user can have independent risk sessions per broker.
/// Automatically picks up DB changes without a Worker restart.
/// Only includes credentials validated by BrokerTokenHelper (non-empty, non-NA, updated after 7:30 AM IST today).
/// </summary>
public sealed class DbUserTokenSource(
    IServiceScopeFactory scopeFactory,
    ILogger<DbUserTokenSource> logger) : IUserTokenSource
{
    public async Task<IReadOnlyList<UserConfig>> GetUsersAsync(CancellationToken ct = default)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Join UserRiskConfigs with BrokerCredentials on (Username, BrokerType = BrokerName)
        var configs = await db.UserRiskConfigs
            .Where(r => r.Enabled)
            .Join(
                db.BrokerCredentials,
                r => new { r.Username, BrokerName = r.BrokerType },
                c => new { c.Username, c.BrokerName },
                (r, c) => new { r, c })
            .ToListAsync(ct);

        // Filter in-memory so BrokerTokenHelper (including JWT check) can be applied.
        configs = configs
            .Where(x =>
            {
                var result = BrokerTokenHelper.Validate(x.c.AccessToken, x.c.UpdatedAt, x.c.BrokerName);
                if (result != TokenValidationResult.Valid)
                    logger.LogDebug("DbUserTokenSource — skipping {User} / {Broker}: token {Reason}",
                        x.r.Username, x.r.BrokerType, result);
                return result == TokenValidationResult.Valid;
            })
            .ToList();

        if (configs.Count == 0)
        {
            logger.LogDebug("DbUserTokenSource: no active configs found (all disabled or tokens stale/missing)");
            return Array.Empty<UserConfig>();
        }

        logger.LogDebug("DbUserTokenSource: loaded {Count} active user-broker session(s)", configs.Count);

        var usernames = configs.Select(x => x.r.Username).Distinct().ToList();
        var tradingSettings = await db.UserTradingSettings
            .Where(s => usernames.Contains(s.Username))
            .ToDictionaryAsync(s => s.Username, ct);

        return configs
            .Select(x =>
            {
                var ts = tradingSettings.GetValueOrDefault(x.r.Username);
                return new UserConfig
                {
                    UserId                = x.r.Username,
                    BrokerType            = x.r.BrokerType,
                    AccessToken           = x.c.AccessToken,
                    ApiKey                = x.c.ApiKey,
                    MtmTarget             = x.r.MtmTarget,
                    MtmSl                 = x.r.MtmSl,
                    TrailingEnabled       = x.r.TrailingEnabled,
                    TrailingActivateAt    = x.r.TrailingActivateAt,
                    LockProfitAt          = x.r.LockProfitAt,
                    WhenProfitIncreasesBy = x.r.IncreaseBy,
                    IncreaseTrailingBy    = x.r.TrailBy,
                    AutoShiftEnabled      = x.r.AutoShiftEnabled,
                    AutoShiftThresholdPct = x.r.AutoShiftThresholdPct,
                    AutoShiftMaxCount     = x.r.AutoShiftMaxCount,
                    AutoShiftStrikeGap    = x.r.AutoShiftStrikeGap,
                    AutoSquareOffEnabled  = ts?.AutoSquareOffEnabled ?? false,
                    AutoSquareOffTime     = TimeSpan.TryParse(ts?.AutoSquareOffTime, out var t) ? t : new TimeSpan(15, 20, 0),
                    WatchedProducts       = x.r.WatchedProducts,
                };
            })
            .ToList()
            .AsReadOnly();
    }
}
