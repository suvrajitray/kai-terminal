using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<BrokerCredential> BrokerCredentials => Set<BrokerCredential>();
    public DbSet<UserTradingSettings> UserTradingSettings => Set<UserTradingSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BrokerCredential>()
            .HasIndex(x => new { x.Username, x.BrokerName })
            .IsUnique();

        modelBuilder.Entity<UserTradingSettings>()
            .HasIndex(x => x.Username)
            .IsUnique();
    }
}
