using KAITerminal.Api.Services;
using KAITerminal.Upstox.Extensions;

namespace KAITerminal.Api.Extensions;

public static class BrokerExtensions
{
    public static IServiceCollection AddBrokerServices(this IServiceCollection services, IConfiguration config)
    {
        services.AddUpstoxSdk(config);

        services.AddScoped<BrokerCredentialService>();

        return services;
    }
}
