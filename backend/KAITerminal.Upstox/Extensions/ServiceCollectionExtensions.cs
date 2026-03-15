using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
    /// <example>
    /// appsettings.json:
    /// <code>
    /// {
    ///   "Upstox": {
    ///     "AccessToken": "your_daily_token_here"
    ///   }
    /// }
    /// </code>
    /// Program.cs:
    /// <code>
    /// builder.Services.AddUpstoxSdk(builder.Configuration);
    /// </code>
    /// </example>
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
        // UpstoxAuthHandler injects the Bearer token per request.
        // It reads from UpstoxTokenContext.Current first (per-call override),
        // then falls back to UpstoxConfig.AccessToken (config / worker-service default).
        services.AddTransient<UpstoxAuthHandler>();

        // Plain client for the token endpoint — no Bearer injection.
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
        services.AddSingleton<IAuthService, AuthService>();
        services.AddSingleton<IPositionService, PositionService>();
        services.AddSingleton<IOrderService, OrderService>();
        services.AddSingleton<IOptionService, OptionService>();
        services.AddSingleton<IMarketQuoteService, MarketQuoteService>();
        services.AddSingleton<IChartDataService, ChartDataService>();

        // Streamers are stateful (own a WebSocket connection) — Transient gives each caller
        // its own independent instance.  The Func<T> factory delegates let UpstoxClient create
        // new streamers on demand without holding a stateful singleton itself.
        services.AddTransient<IMarketDataStreamer, MarketDataStreamer>();
        services.AddTransient<IPortfolioStreamer, PortfolioStreamer>();
        services.AddSingleton<Func<IMarketDataStreamer>>(sp => () => sp.GetRequiredService<IMarketDataStreamer>());
        services.AddSingleton<Func<IPortfolioStreamer>>(sp => () => sp.GetRequiredService<IPortfolioStreamer>());

        services.AddSingleton<UpstoxClient>();

        return services;
    }

    private static UpstoxConfig ResolveConfig(IServiceProvider sp)
    {
        var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<UpstoxConfig>>();
        return options.Value;
    }
}
