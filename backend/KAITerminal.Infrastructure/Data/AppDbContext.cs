using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<BrokerCredential> BrokerCredentials => Set<BrokerCredential>();
    public DbSet<UserTradingSettings> UserTradingSettings => Set<UserTradingSettings>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<UserRiskConfig> UserRiskConfigs => Set<UserRiskConfig>();
    public DbSet<OptionContractCache> OptionContracts => Set<OptionContractCache>();

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

        // Unique per (username, broker) so one user can have independent risk configs per broker.
        // NOTE: If upgrading an existing DB, run manually:
        //   DROP INDEX IF EXISTS "ix_userriskconfigs_username";
        //   CREATE UNIQUE INDEX "ix_userriskconfigs_username_broker" ON "UserRiskConfigs" ("Username", "BrokerType");
        modelBuilder.Entity<UserRiskConfig>()
            .HasIndex(x => new { x.Username, x.BrokerType })
            .IsUnique();

        modelBuilder.Entity<OptionContractCache>()
            .HasIndex(o => o.Broker)
            .IsUnique();
    }
}
