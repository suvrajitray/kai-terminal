using KAITerminal.Api.Services;
using KAITerminal.Broker;
using KAITerminal.Broker.Adapters;
using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Infrastructure.Services;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Upstox.Options;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Extensions;
using KAITerminal.Zerodha.Options;

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
            creators["upstox"] = (token, _) => new UpstoxBrokerClient(upstox, token);

            var zerodha = sp.GetService<ZerodhaClient>();
            if (zerodha is not null)
                creators["zerodha"] = (token, apiKey) =>
                    new ZerodhaBrokerClient(zerodha, apiKey!, token);

            return new BrokerClientFactory(creators);
        });

        // Register broker-agnostic option contract providers
        services.AddSingleton<IOptionContractProvider, UpstoxOptionContractProvider>();
        services.AddSingleton<IOptionContractProvider, ZerodhaOptionContractProvider>();

        // RedisLtpRelay: receives LTP ticks from Redis (published by AdminMarketDataService in the Worker)
        // and fans them out in-process to PositionStreamCoordinator via ISharedMarketDataService.FeedReceived.
        services.AddSingleton<RedisLtpRelay>();
        services.AddSingleton<ISharedMarketDataService>(sp => sp.GetRequiredService<RedisLtpRelay>());
        services.AddHostedService(sp => sp.GetRequiredService<RedisLtpRelay>());

        services.AddScoped<BrokerCredentialService>();
        services.AddScoped<IAiSentimentService, AiSentimentService>();

        RegisterAiHttpClients(services, config);

        return services;
    }

    private static void RegisterAiHttpClients(IServiceCollection services, IConfiguration config)
    {
        var cfg = config.GetSection("AiSentiment");

        services.AddHttpClient("OpenAi", client =>
        {
            client.BaseAddress = new Uri("https://api.openai.com");
            var key = cfg["OpenAiApiKey"];
            if (!string.IsNullOrEmpty(key))
                client.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", key);
        });

        services.AddHttpClient("Grok", client =>
        {
            client.BaseAddress = new Uri("https://api.x.ai");
            var key = cfg["GrokApiKey"];
            if (!string.IsNullOrEmpty(key))
                client.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", key);
        });

        services.AddHttpClient("Gemini", client =>
        {
            client.BaseAddress = new Uri("https://generativelanguage.googleapis.com");
        });

        services.AddHttpClient("Claude", client =>
        {
            client.BaseAddress = new Uri("https://api.anthropic.com");
        });
    }
}
