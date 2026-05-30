using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;

namespace KAITerminal.Zerodha.Http;

public sealed partial class ZerodhaHttpClient
{
    public async Task<string> ExchangeTokenAsync(
        string apiKey, string apiSecret, string requestToken, CancellationToken ct = default)
    {
        var (accessToken, _) = await ExchangeTokenWithUserIdAsync(apiKey, apiSecret, requestToken, ct);
        return accessToken;
    }

    public async Task<(string AccessToken, string? UserId)> ExchangeTokenWithUserIdAsync(
        string apiKey, string apiSecret, string requestToken, CancellationToken ct = default)
    {
        var checksum = ComputeChecksum(apiKey, requestToken, apiSecret);

        var http = _httpFactory.CreateClient("ZerodhaAuth");
        var form = new Dictionary<string, string>
        {
            ["api_key"]       = apiKey,
            ["request_token"] = requestToken,
            ["checksum"]      = checksum,
        };

        var response = await http.PostAsync("/session/token", new FormUrlEncodedContent(form), ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<KiteEnvelope<KiteSessionData>>(_json, ct)
            ?? throw new InvalidOperationException("Null response exchanging Zerodha token");

        EnsureSuccess(result);
        var accessToken = result.Data?.AccessToken
            ?? throw new InvalidOperationException("No access_token in Zerodha session response");
        return (accessToken, result.Data?.UserId);
    }

    public string GetLoginUrl(string apiKey)
        => $"https://kite.zerodha.com/connect/login?api_key={apiKey}&v=3";

    private static string ComputeChecksum(string apiKey, string requestToken, string apiSecret)
    {
        var raw  = Encoding.UTF8.GetBytes(apiKey + requestToken + apiSecret);
        var hash = SHA256.HashData(raw);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private sealed class KiteSessionData
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; init; }
        [JsonPropertyName("api_key")]      public string? ApiKey      { get; init; }
        [JsonPropertyName("user_id")]      public string? UserId      { get; init; }
        [JsonPropertyName("user_name")]    public string? UserName    { get; init; }
        [JsonPropertyName("email")]        public string? Email       { get; init; }
    }
}
