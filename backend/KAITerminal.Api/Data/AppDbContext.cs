using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<BrokerCredential> BrokerCredentials => Set<BrokerCredential>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BrokerCredential>()
            .HasIndex(x => new { x.Username, x.BrokerName })
            .IsUnique();
    }
}
