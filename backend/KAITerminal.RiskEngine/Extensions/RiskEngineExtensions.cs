using KAITerminal.Contracts.Notifications;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Notifications;
using KAITerminal.RiskEngine.Services;
using KAITerminal.RiskEngine.State;
using KAITerminal.RiskEngine.Workers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace KAITerminal.RiskEngine.Extensions;

public static class RiskEngineExtensions
{
    /// <summary>
    /// Registers the risk engine services and the WebSocket-driven <see cref="StreamingRiskWorker"/>.
    /// <typeparamref name="TTokenSource"/> must implement <see cref="IUserTokenSource"/>.
    /// </summary>
    public static IServiceCollection AddRiskEngine<TTokenSource>(
        this IServiceCollection services,
        IConfiguration configuration)
        where TTokenSource : class, IUserTokenSource
    {
        services.Configure<RiskEngineConfig>(configuration.GetSection(RiskEngineConfig.SectionName));

        services.TryAddSingleton<IRiskEventNotifier, NullRiskEventNotifier>();

        services.AddSingleton<IRiskRepository, RedisRiskRepository>();
        services.AddSingleton<IPositionCache, PositionCache>();
        services.AddSingleton<IUserTokenSource, TTokenSource>();

        services.AddSingleton<RiskEvaluator>();
        services.AddHostedService<StreamingRiskWorker>();

        return services;
    }
}
