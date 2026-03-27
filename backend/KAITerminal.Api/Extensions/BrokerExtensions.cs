using KAITerminal.Api.Services;
using KAITerminal.Broker;
using KAITerminal.MarketData.Services;
using KAITerminal.Broker.Adapters;
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
            creators["upstox"] = (token, _) => new UpstoxBrokerClient(upstox, token);

            var zerodha = sp.GetService<ZerodhaClient>();
            if (zerodha is not null)
                creators["zerodha"] = (token, apiKey) =>
                    new ZerodhaBrokerClient(zerodha, apiKey!, token);

            return new BrokerClientFactory(creators);
        });

        // MarketDataConsumer: subscribes to Redis pub/sub for live LTP ticks.
        // Also registers IOptionContractProvider (both brokers), IOptionChainProvider, IZerodhaInstrumentService.
        services.AddMarketDataConsumer();

        services.AddSingleton<OptionStrikeService>();
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
