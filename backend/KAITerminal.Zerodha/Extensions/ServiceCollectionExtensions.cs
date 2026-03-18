using KAITerminal.Contracts.Streaming;
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

        // Public data client — no auth header; used for instrument master CSV downloads
        services.AddHttpClient("ZerodhaData", (sp, client) =>
        {
            var cfg = ResolveConfig(sp);
            client.BaseAddress = new Uri(cfg.ApiBaseUrl);
            client.Timeout = TimeSpan.FromSeconds(60); // instrument CSVs can be large
            client.DefaultRequestHeaders.Add("X-Kite-Version", "3");
        });

        services.AddSingleton<ZerodhaHttpClient>();
        services.AddSingleton<IZerodhaAuthService,       ZerodhaAuthService>();
        services.AddSingleton<IZerodhaPositionService,   ZerodhaPositionService>();
        services.AddSingleton<IZerodhaOrderService,      ZerodhaOrderService>();
        services.AddSingleton<IZerodhaFundsService,      ZerodhaFundsService>();
        services.AddSingleton<IZerodhaInstrumentService, ZerodhaInstrumentService>();

        // Streamers are stateful — Transient gives each caller its own independent instance
        services.AddTransient<KiteTickerStreamer>();
        services.AddTransient<ZerodhaPortfolioStreamer>();
        services.AddSingleton<Func<KiteTickerStreamer>>(sp => () => sp.GetRequiredService<KiteTickerStreamer>());
        services.AddSingleton<Func<ZerodhaPortfolioStreamer>>(sp => () => sp.GetRequiredService<ZerodhaPortfolioStreamer>());

        services.AddSingleton<ZerodhaClient>();

        return services;
    }

    private static ZerodhaConfig ResolveConfig(IServiceProvider sp)
    {
        var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<ZerodhaConfig>>();
        return options.Value;
    }
}
