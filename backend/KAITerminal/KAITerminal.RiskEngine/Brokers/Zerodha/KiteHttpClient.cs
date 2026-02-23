using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Brokers.Zerodha;

public class KiteHttpClient
{
  private readonly HttpClient _http;
  private readonly ILogger<KiteHttpClient> _logger;
  private readonly ZerodhaSettings _settings;

  public KiteHttpClient(
    HttpClient http,
    IOptions<ZerodhaSettings> settings,
    ILogger<KiteHttpClient> logger)
  {
    _http = http;
    _logger = logger;
    _settings = settings.Value;
    logger.LogInformation(
      "KiteHttpClient initialized with API Key: {ApiKey}, API Secret: {ApiSecret}, Access Token: {AccessToken}", _settings.ApiKey, _settings.ApiSecret, _settings.AccessToken);

    _http.DefaultRequestHeaders.Add("X-Kite-Version", "3");
    _http.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("token",
            $"{_settings.ApiKey}:{_settings.AccessToken}");
  }

  public async Task<HttpResponseMessage> PostAsync(
      string url,
      Dictionary<string, string> form)
  {
    return await _http.PostAsync(url, new FormUrlEncodedContent(form));
  }

  public async Task<string> GetStringAsync(string url)
  {
    return await _http.GetStringAsync(url);
  }
}
