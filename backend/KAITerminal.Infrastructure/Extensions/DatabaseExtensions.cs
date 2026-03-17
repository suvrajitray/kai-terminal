using KAITerminal.Infrastructure.Data;
using KAITerminal.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.Infrastructure.Extensions;

public static class DatabaseExtensions
{
    public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(config.GetConnectionString("DefaultConnection")));

        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IRiskConfigService, RiskConfigService>();

        return services;
    }
}
