using System.Text.Json;
using KAITerminal.Broker.Interfaces;
using KAITerminal.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.Broker.Upstox;

public class UpstoxTokenGenerator(
    UpstoxHttpClient upstox,
    IOptions<UpstoxSettings> settings,
    ILogger<UpstoxTokenGenerator> logger) : ITokenGenerator
{
    private readonly UpstoxSettings _settings = settings.Value;

    public async Task<AccessToken> GenerateAccessTokenAsync(
        string apiKey,
        string apiSecret,
        string requestToken,
        CancellationToken ct = default)
    {
        logger.LogInformation("Generating Upstox access token for API key {ApiKey}", apiKey);

        var form = new Dictionary<string, string>
        {
            ["code"] = requestToken,
            ["client_id"] = apiKey,
            ["client_secret"] = apiSecret,
            ["redirect_uri"] = _settings.RedirectUri,
            ["grant_type"] = "authorization_code"
        };

        var response = await upstox.PostFormAsync(
            "https://api.upstox.com/v2/login/authorization/token",
            form,
            ct);

        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync(ct);
        var accessToken = JsonDocument.Parse(json).RootElement
            .GetProperty("data")
            .GetProperty("access_token")
            .GetString()!;

        logger.LogInformation("Generated Upstox access token for API key {ApiKey}", apiKey);
        return new AccessToken(accessToken);
    }
}
