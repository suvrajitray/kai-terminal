using System.Text.Json;
using KAITerminal.Upstox.Exceptions;
using KAITerminal.Upstox.Models;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Http;

internal sealed partial class UpstoxHttpClient
{
    public async Task<TokenResponse> GenerateTokenAsync(
        string clientId, string clientSecret, string redirectUri, string authorizationCode,
        CancellationToken ct = default)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"]          = authorizationCode,
            ["client_id"]     = clientId,
            ["client_secret"] = clientSecret,
            ["redirect_uri"]  = redirectUri,
            ["grant_type"]    = "authorization_code"
        });

        var client = _factory.CreateClient("UpstoxAuth");
        var response = await client.PostAsync("/v2/login/authorization/token", form, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new UpstoxException($"Token generation failed: {json}", (int)response.StatusCode);

        return JsonSerializer.Deserialize<TokenResponse>(json, JsonOptions)
            ?? throw new UpstoxException("Empty or invalid token response from Upstox");
    }
}
