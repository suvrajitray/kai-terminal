using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<BrokerCredential> BrokerCredentials => Set<BrokerCredential>();
    public DbSet<UserTradingSettings> UserTradingSettings => Set<UserTradingSettings>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<UserRiskConfig> UserRiskConfigs => Set<UserRiskConfig>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BrokerCredential>()
            .HasIndex(x => new { x.Username, x.BrokerName })
            .IsUnique();

        modelBuilder.Entity<UserTradingSettings>()
            .HasIndex(x => x.Username)
            .IsUnique();

        modelBuilder.Entity<AppUser>()
            .HasIndex(x => x.Email)
            .IsUnique();

        modelBuilder.Entity<UserRiskConfig>()
            .HasIndex(x => x.Username)
            .IsUnique();
    }
}
