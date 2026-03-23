using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace KAITerminal.Api.Extensions;

public static class DatabaseExtensions
{
    public static async Task InitializeDatabaseAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var sp = scope.ServiceProvider;

        var db = sp.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync();

        // Warm Redis with all AppSettings so MasterDataService never hits the DB for tokens
        var redis = sp.GetService<IConnectionMultiplexer>();
        if (redis is not null)
        {
            var settings = await db.AppSettings.ToListAsync();
            if (settings.Count > 0)
            {
                var redisDb = redis.GetDatabase();
                var batch   = redisDb.CreateBatch();
                var tasks   = settings.Select(s =>
                    batch.StringSetAsync($"appsetting:{s.Key}", s.Value)).ToList();
                batch.Execute();
                await Task.WhenAll(tasks);

                var logger = sp.GetRequiredService<ILogger<AppDbContext>>();
                logger.LogInformation(
                    "Warmed Redis with {Count} app setting(s)", settings.Count);
            }
        }
    }
}
