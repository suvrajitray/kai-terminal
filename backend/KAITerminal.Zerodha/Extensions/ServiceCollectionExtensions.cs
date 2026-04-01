using KAITerminal.Broker;
using KAITerminal.Zerodha.Configuration;
using KAITerminal.Zerodha.Http;
using KAITerminal.Zerodha.Services;
using KAITerminal.Zerodha.Streaming;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.Zerodha.Extensions;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the Zerodha Kite Connect SDK services with the DI container.
    /// Reads configuration from the "Zerodha" config section.
    /// </summary>
    public static IServiceCollection AddZerodhaSdk(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<ZerodhaConfig>(configuration.GetSection(ZerodhaConfig.SectionName));
        return RegisterCore(services, configuration);
    }

    private static IServiceCollection RegisterCore(
        IServiceCollection services, IConfiguration configuration)
    {
        services.AddTransient<ZerodhaAuthHandler>();

        // Authenticated client — injects "token api_key:access_token" via ZerodhaAuthHandler
        services.AddHttpClient("ZerodhaApi", (sp, client) =>
        {
            var cfg = ResolveConfig(sp);
            client.BaseAddress = new Uri(cfg.ApiBaseUrl);
            client.Timeout = cfg.HttpTimeout;
            client.DefaultRequestHeaders.Add("Accept", "application/json");
            client.DefaultRequestHeaders.Add("X-Kite-Version", "3");
        }).AddHttpMessageHandler<ZerodhaAuthHandler>();

        // Auth-only client — no auth header (session/token endpoint)
        services.AddHttpClient("ZerodhaAuth", (sp, client) =>
        {
            var cfg = ResolveConfig(sp);
            client.BaseAddress = new Uri(cfg.ApiBaseUrl);
            client.Timeout = cfg.HttpTimeout;
            client.DefaultRequestHeaders.Add("X-Kite-Version", "3");
        });

        services.AddSingleton<ZerodhaHttpClient>();

        // Register each service under its concrete type first, then alias to the common interface.
        // This ensures ZerodhaClient always gets Zerodha implementations regardless of registration order.
        services.AddSingleton<ZerodhaAuthService>();
        services.AddSingleton<IBrokerAuthService>(sp => sp.GetRequiredService<ZerodhaAuthService>());

        services.AddSingleton<ZerodhaPositionService>();
        services.AddSingleton<IBrokerPositionService>(sp => sp.GetRequiredService<ZerodhaPositionService>());

        services.AddSingleton<ZerodhaOrderService>();
        services.AddSingleton<IBrokerOrderService>(sp => sp.GetRequiredService<ZerodhaOrderService>());

        services.AddSingleton<ZerodhaFundsService>();
        services.AddSingleton<IBrokerFundsService>(sp => sp.GetRequiredService<ZerodhaFundsService>());

        services.AddSingleton<ZerodhaMarginService>();
        services.AddSingleton<IBrokerMarginService>(sp => sp.GetRequiredService<ZerodhaMarginService>());

        // KiteTickerStreamer is stateful — Transient gives each caller its own independent instance
        services.AddTransient<KiteTickerStreamer>();
        services.AddSingleton<Func<KiteTickerStreamer>>(sp => () => sp.GetRequiredService<KiteTickerStreamer>());

        services.AddSingleton<ZerodhaClient>(sp => new ZerodhaClient(
            sp.GetRequiredService<ZerodhaAuthService>(),
            sp.GetRequiredService<ZerodhaPositionService>(),
            sp.GetRequiredService<ZerodhaOrderService>(),
            sp.GetRequiredService<ZerodhaFundsService>(),
            sp.GetRequiredService<ZerodhaMarginService>()));

        return services;
    }

    private static ZerodhaConfig ResolveConfig(IServiceProvider sp)
    {
        var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<ZerodhaConfig>>();
        return options.Value;
    }
}
