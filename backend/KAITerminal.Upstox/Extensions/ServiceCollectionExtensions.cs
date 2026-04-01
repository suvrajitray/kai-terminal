using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using KAITerminal.Broker;
using KAITerminal.Upstox.Configuration;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Services;

namespace KAITerminal.Upstox.Extensions;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the Upstox SDK services with the DI container.
    /// Reads configuration from <c>IConfiguration</c> section "Upstox".
    /// </summary>
    public static IServiceCollection AddUpstoxSdk(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<UpstoxConfig>(configuration.GetSection(UpstoxConfig.SectionName));
        return RegisterCore(services, configuration);
    }

    /// <summary>
    /// Registers the Upstox SDK services with an explicit configuration action.
    /// </summary>
    public static IServiceCollection AddUpstoxSdk(
        this IServiceCollection services,
        Action<UpstoxConfig> configure)
    {
        services.Configure(configure);
        return RegisterCore(services, configuration: null);
    }

    private static IServiceCollection RegisterCore(
        IServiceCollection services, IConfiguration? configuration)
    {
        services.AddTransient<UpstoxAuthHandler>();

        services.AddHttpClient("UpstoxAuth", (sp, client) =>
        {
            var cfg = ResolveConfig(sp);
            client.BaseAddress = new Uri(cfg.ApiBaseUrl);
            client.Timeout = cfg.HttpTimeout;
        });

        services.AddHttpClient("UpstoxApi", (sp, client) =>
        {
            var cfg = ResolveConfig(sp);
            client.BaseAddress = new Uri(cfg.ApiBaseUrl);
            client.Timeout = cfg.HttpTimeout;
            client.DefaultRequestHeaders.Add("Accept", "application/json");
        }).AddHttpMessageHandler<UpstoxAuthHandler>();

        services.AddHttpClient("UpstoxHft", (sp, client) =>
        {
            var cfg = ResolveConfig(sp);
            client.BaseAddress = new Uri(cfg.HftBaseUrl);
            client.Timeout = cfg.HttpTimeout;
            client.DefaultRequestHeaders.Add("Accept", "application/json");
        }).AddHttpMessageHandler<UpstoxAuthHandler>();

        services.AddSingleton<UpstoxHttpClient>();

        // Register each service under its concrete type first, then alias to the common interface.
        // This ensures UpstoxClient always gets Upstox implementations regardless of registration order.
        services.AddSingleton<UpstoxAuthService>();
        services.AddSingleton<IBrokerAuthService>(sp => sp.GetRequiredService<UpstoxAuthService>());

        services.AddSingleton<UpstoxPositionService>();
        services.AddSingleton<IBrokerPositionService>(sp => sp.GetRequiredService<UpstoxPositionService>());

        services.AddSingleton<UpstoxOrderService>();
        services.AddSingleton<IBrokerOrderService>(sp => sp.GetRequiredService<UpstoxOrderService>());
        services.AddSingleton<IUpstoxHftService>(sp => sp.GetRequiredService<UpstoxOrderService>());

        services.AddSingleton<UpstoxMarginService>();
        services.AddSingleton<IBrokerMarginService>(sp => sp.GetRequiredService<UpstoxMarginService>());

        services.AddSingleton<UpstoxFundsService>();
        services.AddSingleton<IBrokerFundsService>(sp => sp.GetRequiredService<UpstoxFundsService>());

        services.AddSingleton<UpstoxClient>(sp => new UpstoxClient(
            sp.GetRequiredService<UpstoxAuthService>(),
            sp.GetRequiredService<UpstoxPositionService>(),
            sp.GetRequiredService<UpstoxOrderService>(),
            sp.GetRequiredService<UpstoxMarginService>(),
            sp.GetRequiredService<UpstoxFundsService>()));

        return services;
    }

    private static UpstoxConfig ResolveConfig(IServiceProvider sp)
    {
        var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<UpstoxConfig>>();
        return options.Value;
    }
}
