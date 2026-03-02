using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Services;
using KAITerminal.RiskEngine.State;
using KAITerminal.RiskEngine.Workers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.RiskEngine.Extensions;

public static class RiskEngineExtensions
{
    /// <summary>
    /// Registers the risk engine services and both background workers.
    /// <typeparamref name="TTokenSource"/> must implement <see cref="IUserTokenSource"/>.
    /// </summary>
    public static IServiceCollection AddRiskEngine<TTokenSource>(
        this IServiceCollection services,
        IConfiguration configuration)
        where TTokenSource : class, IUserTokenSource
    {
        services.Configure<RiskEngineConfig>(configuration.GetSection(RiskEngineConfig.SectionName));

        services.AddSingleton<IRiskRepository, InMemoryRiskRepository>();
        services.AddSingleton<IUserTokenSource, TTokenSource>();

        services.AddSingleton<RiskEvaluator>();
        services.AddSingleton<StrikeMonitor>();

        services.AddHostedService<PortfolioRiskWorker>();
        services.AddHostedService<StrikeRiskWorker>();

        return services;
    }
}
