using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<BrokerCredential> BrokerCredentials => Set<BrokerCredential>();
    public DbSet<UserTradingSettings> UserTradingSettings => Set<UserTradingSettings>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<UserRiskConfig> UserRiskConfigs => Set<UserRiskConfig>();
    public DbSet<AppSetting>    AppSettings    => Set<AppSetting>();
    public DbSet<IvSnapshot>    IvSnapshots    => Set<IvSnapshot>();
    public DbSet<RiskEngineLog>   RiskEngineLogs   => Set<RiskEngineLog>();
    public DbSet<AutoEntryConfig> AutoEntryConfigs  => Set<AutoEntryConfig>();
    public DbSet<AutoEntryLog>    AutoEntryLogs     => Set<AutoEntryLog>();
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

        modelBuilder.Entity<AppSetting>()
            .HasKey(x => x.Key);

        modelBuilder.Entity<IvSnapshot>()
            .HasIndex(x => new { x.Date, x.Underlying, x.Expiry })
            .IsUnique();
        modelBuilder.Entity<IvSnapshot>()
            .HasIndex(x => new { x.Underlying, x.Date });

        modelBuilder.Entity<AutoEntryConfig>()
            .HasIndex(x => x.Username);

        modelBuilder.Entity<AutoEntryLog>()
            .HasIndex(x => x.StrategyId);
    }
}
