using System.Text.Json;
using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Models;
using KAITerminal.Broker.Util;
using KAITerminal.Types;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Broker.Zerodha;

public class ZerodhaTokenGenerator(
  KiteConnectHttpClient kiteConnect,
  ILogger<ZerodhaTokenGenerator> logger) : ITokenGenerator
{
  public async Task<AccessToken> GenerateAccessTokenAsync(
    string apiKey,
    string apiSecret,
    string requestToken,
    CancellationToken ct = default)
  {
    logger.LogInformation("Generating access token for API key {ApiKey}", apiKey);
    var checksum = KiteChecksum.Generate(
        apiKey,
        requestToken,
        apiSecret);

    var form = new Dictionary<string, string>
    {
      ["api_key"] = apiKey,
      ["request_token"] = requestToken,
      ["checksum"] = checksum
    };

    var response = await kiteConnect.PostAsync(
        new AccessToken(string.Empty),
        "/session/token",
        form,
        ct);

    response.EnsureSuccessStatusCode();
    var json = await response.Content.ReadAsStringAsync(ct);
    var token = JsonDocument.Parse(json).RootElement
                 .GetProperty("data")
                 .GetProperty("access_token");
    logger.LogInformation("Generated access token for API key {ApiKey}, access token: {AccessToken}", apiKey, token.GetString());
    return new AccessToken(token.GetString()!);
  }
}
