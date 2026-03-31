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
        services.AddSingleton<IBrokerAuthService, UpstoxAuthService>();
        services.AddSingleton<IUpstoxPositionService, UpstoxPositionService>();
        services.AddSingleton<IUpstoxOrderService, UpstoxOrderService>();
        services.AddSingleton<IBrokerMarginService, UpstoxMarginService>();
        services.AddSingleton<IBrokerFundsService, UpstoxFundsService>();

        services.AddSingleton<UpstoxClient>();

        return services;
    }

    private static UpstoxConfig ResolveConfig(IServiceProvider sp)
    {
        var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<UpstoxConfig>>();
        return options.Value;
    }
}
