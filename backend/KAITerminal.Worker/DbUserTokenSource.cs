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
/// </summary>
public sealed class DbUserTokenSource(IServiceScopeFactory scopeFactory) : IUserTokenSource
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
            .Where(x => x.c.AccessToken != null && x.c.AccessToken != "" && x.c.AccessToken != "NA")
            .ToListAsync(ct);

        return configs
            .Select(x => new UserConfig
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
            })
            .ToList()
            .AsReadOnly();
    }
}
