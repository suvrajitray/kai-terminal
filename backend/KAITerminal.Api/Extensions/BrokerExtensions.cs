using KAITerminal.Api.Services;
using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Zerodha;

namespace KAITerminal.Api.Extensions;

public static class BrokerExtensions
{
    public static IServiceCollection AddBrokerServices(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<ZerodhaSettings>(config.GetSection("Zerodha"));

        services.AddHttpClient<KiteConnectHttpClient>();

        services.AddTransient<IPositionProvider, ZerodhaPositionProvider>();
        services.AddTransient<IOrderExecutor, ZerodhaOrderExecutor>();
        services.AddTransient<ITokenGenerator, ZerodhaTokenGenerator>();

        services.AddScoped<BrokerCredentialService>();

        return services;
    }
}
