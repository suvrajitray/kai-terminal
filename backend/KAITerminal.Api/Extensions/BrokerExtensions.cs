using KAITerminal.Api.Services;
using KAITerminal.Upstox.Extensions;

namespace KAITerminal.Api.Extensions;

public static class BrokerExtensions
{
    public static IServiceCollection AddBrokerServices(this IServiceCollection services, IConfiguration config)
    {
        services.AddUpstoxSdk(config);

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
