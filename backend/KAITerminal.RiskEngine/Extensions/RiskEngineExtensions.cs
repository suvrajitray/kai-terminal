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
    /// Registers the risk engine services and background workers.
    /// When <c>RiskEngine:EnableStreamingMode</c> is <c>true</c>, the WebSocket-driven
    /// <see cref="StreamingRiskWorker"/> is used; otherwise the two interval-based workers are used.
    /// <typeparamref name="TTokenSource"/> must implement <see cref="IUserTokenSource"/>.
    /// </summary>
    public static IServiceCollection AddRiskEngine<TTokenSource>(
        this IServiceCollection services,
        IConfiguration configuration)
        where TTokenSource : class, IUserTokenSource
    {
        services.Configure<RiskEngineConfig>(configuration.GetSection(RiskEngineConfig.SectionName));

        services.AddSingleton<IRiskRepository, InMemoryRiskRepository>();
        services.AddSingleton<IPositionCache, PositionCache>();
        services.AddSingleton<IUserTokenSource, TTokenSource>();

        services.AddSingleton<RiskEvaluator>();
        services.AddSingleton<StrikeMonitor>();

        var streamingEnabled = configuration.GetValue<bool>($"{RiskEngineConfig.SectionName}:EnableStreamingMode");
        if (streamingEnabled)
        {
            services.AddHostedService<StreamingRiskWorker>();
        }
        else
        {
            services.AddHostedService<PortfolioRiskWorker>();
            services.AddHostedService<StrikeRiskWorker>();
        }

        return services;
    }
}
