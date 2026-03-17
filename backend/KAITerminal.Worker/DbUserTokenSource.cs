using KAITerminal.Infrastructure.Data;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.Worker;

/// <summary>
/// Reads enabled users and their risk configs from the database on every call.
/// Automatically picks up changes without a Worker restart.
/// </summary>
public sealed class DbUserTokenSource(IServiceScopeFactory scopeFactory) : IUserTokenSource
{
    public async Task<IReadOnlyList<UserConfig>> GetUsersAsync(CancellationToken ct = default)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var configs = await db.UserRiskConfigs
            .Where(r => r.Enabled)
            .Join(
                db.BrokerCredentials,
                r => r.Username,
                c => c.Username,
                (r, c) => new { r, c })
            .ToListAsync(ct);

        return configs
            .Select(x => new UserConfig
            {
                UserId               = x.r.Username,
                AccessToken          = x.c.AccessToken,
                MtmTarget            = x.r.MtmTarget,
                MtmSl                = x.r.MtmSl,
                TrailingEnabled      = x.r.TrailingEnabled,
                TrailingActivateAt   = x.r.TrailingActivateAt,
                LockProfitAt         = x.r.LockProfitAt,
                WhenProfitIncreasesBy = x.r.IncreaseBy,
                IncreaseTrailingBy   = x.r.TrailBy,
            })
            .Where(u => !string.IsNullOrEmpty(u.AccessToken) && u.AccessToken != "NA")
            .ToList()
            .AsReadOnly();
    }
}
