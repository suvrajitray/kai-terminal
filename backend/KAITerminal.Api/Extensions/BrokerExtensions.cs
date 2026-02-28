using KAITerminal.Api.Services;
using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Upstox;

namespace KAITerminal.Api.Extensions;

public static class BrokerExtensions
{
    public static IServiceCollection AddBrokerServices(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<UpstoxSettings>(config.GetSection("Upstox"));

        services.AddHttpClient<UpstoxHttpClient>();

        services.AddTransient<IPositionProvider, UpstoxPositionProvider>();
        services.AddTransient<IOrderExecutor, UpstoxOrderExecutor>();
        services.AddTransient<ITokenGenerator, UpstoxTokenGenerator>();

        services.AddScoped<BrokerCredentialService>();

        return services;
    }
}
