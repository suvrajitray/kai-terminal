using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Broker;
using KAITerminal.MarketData.Services;
using KAITerminal.MarketData.Extensions;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Extensions;

namespace KAITerminal.Api.Extensions;

public static class BrokerExtensions
{
    public static IServiceCollection AddBrokerServices(this IServiceCollection services, IConfiguration config)
    {
        services.AddUpstoxSdk(config);
        services.AddZerodhaSdk(config);

        // Register IBrokerClientFactory — maps broker type strings to token-scoped client instances
        services.AddSingleton<IBrokerClientFactory>(sp =>
        {
            var creators = new Dictionary<string, Func<string, string?, IBrokerClient>>(
                StringComparer.OrdinalIgnoreCase);

            var upstox = sp.GetRequiredService<UpstoxClient>();
            creators[BrokerNames.Upstox] = (token, _) => new UpstoxBrokerClient(upstox, token);

            var zerodha = sp.GetService<ZerodhaClient>();
            if (zerodha is not null)
                creators[BrokerNames.Zerodha] = (token, apiKey) =>
                    new ZerodhaBrokerClient(zerodha, apiKey!, token);

            return new BrokerClientFactory(creators);
        });

        // MarketDataConsumer: subscribes to Redis pub/sub for live LTP ticks.
        // Also registers IOptionContractProvider (both brokers), IOptionChainProvider, IZerodhaInstrumentService.
        services.AddMarketDataConsumer();

        services.AddSingleton<OptionStrikeService>();
        services.AddScoped<BrokerCredentialService>();

        return services;
    }
}
