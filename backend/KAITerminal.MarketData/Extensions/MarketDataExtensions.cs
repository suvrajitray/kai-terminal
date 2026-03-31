using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Options;
using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Configuration;
using KAITerminal.MarketData.Http;
using KAITerminal.MarketData.Options;
using KAITerminal.MarketData.Services;
using KAITerminal.MarketData.Streaming;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.MarketData.Extensions;

public static class MarketDataExtensions
{
    /// <summary>
    /// Registers <see cref="MarketDataService"/> as the <see cref="ISharedMarketDataService"/> producer.
    /// Use in the Worker process — opens the upstream Upstox WebSocket and publishes ticks to Redis.
    /// </summary>
    public static IServiceCollection AddMarketDataProducer(this IServiceCollection services)
    {
        RegisterShared(services);

        services.AddSingleton<MarketDataService>();
        services.AddSingleton<ISharedMarketDataService>(sp => sp.GetRequiredService<MarketDataService>());
        services.AddHostedService(sp => sp.GetRequiredService<MarketDataService>());
        return services;
    }

    /// <summary>
    /// Registers <see cref="RedisLtpRelay"/> as the <see cref="ISharedMarketDataService"/> consumer.
    /// Use in the Api process — subscribes to Redis pub/sub and relays ticks in-process.
    /// </summary>
    public static IServiceCollection AddMarketDataConsumer(this IServiceCollection services)
    {
        RegisterShared(services);

        services.AddSingleton<RedisLtpRelay>();
        services.AddSingleton<ISharedMarketDataService>(sp => sp.GetRequiredService<RedisLtpRelay>());
        services.AddHostedService(sp => sp.GetRequiredService<RedisLtpRelay>());
        return services;
    }

    // ── Shared registrations (both producer and consumer) ─────────────────────

    private static void RegisterShared(IServiceCollection services)
    {
        // Named HttpClients for market data APIs — no auth handler; token injected per call
        services.AddHttpClient("UpstoxMarketData", (sp, client) =>
        {
            var cfg = ResolveConfig(sp);
            client.BaseAddress = new Uri(cfg.BaseUrl);
            client.Timeout     = cfg.HttpTimeout;
            client.DefaultRequestHeaders.Add("Accept", "application/json");
        });

        // Public Zerodha data client — no auth required (instrument CSV downloads)
        services.AddHttpClient("ZerodhaData", (sp, client) =>
        {
            var cfg = ResolveConfig(sp);
            client.BaseAddress = new Uri(cfg.ZerodhaDataBaseUrl);
            client.Timeout     = TimeSpan.FromSeconds(60); // CSVs can be large
            client.DefaultRequestHeaders.Add("X-Kite-Version", "3");
        });

        services.AddSingleton<UpstoxMarketDataHttpClient>();

        // Market data services (use analytics token internally)
        services.AddSingleton<IMarketQuoteService, MarketQuoteService>();

        // Zerodha instrument CSV service
        services.AddSingleton<IZerodhaInstrumentService, ZerodhaInstrumentService>();

        // Option contract providers (registered via IEnumerable<IOptionContractProvider>)
        services.AddSingleton<IOptionContractProvider, UpstoxOptionContractProvider>();
        services.AddSingleton<IOptionContractProvider, ZerodhaOptionContractProvider>();

        // Option chain provider (analytics token, no user token required)
        services.AddSingleton<IOptionChainProvider, UpstoxOptionChainProvider>();

        // Token mapping provider for cross-broker LTP (Zerodha → Upstox feed tokens)
        services.AddSingleton<ITokenMappingProvider, ZerodhaTokenMappingProvider>();

        // Streamer factory: analytics token is passed at construction time
        services.AddSingleton<Func<string, IMarketDataStreamer>>(sp => token =>
        {
            var http    = sp.GetRequiredService<UpstoxMarketDataHttpClient>();
            var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MarketDataConfig>>();
            var logger  = sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<UpstoxMarketDataStreamer>>();
            return new UpstoxMarketDataStreamer(http, options, logger, token);
        });
    }

    private static MarketDataConfig ResolveConfig(IServiceProvider sp)
    {
        var options = sp.GetService<Microsoft.Extensions.Options.IOptions<MarketDataConfig>>();
        return options?.Value ?? new MarketDataConfig();
    }
}
