using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Services;
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
        services.AddSingleton<RedisLtpRelay>();
        services.AddSingleton<ISharedMarketDataService>(sp => sp.GetRequiredService<RedisLtpRelay>());
        services.AddHostedService(sp => sp.GetRequiredService<RedisLtpRelay>());
        return services;
    }
}
