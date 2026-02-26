using System.Net.Http.Headers;
using KAITerminal.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.Broker.Zerodha;

public class KiteConnectHttpClient
{
  private readonly HttpClient _http;
  private readonly ZerodhaSettings _settings;
  private readonly ILogger<KiteConnectHttpClient> _logger;

  public KiteConnectHttpClient(
      HttpClient http,
      IOptions<ZerodhaSettings> settings,
      ILogger<KiteConnectHttpClient> logger)
  {
    _http = http;
    _settings = settings.Value;
    _logger = logger;

    _http.BaseAddress = new Uri(_settings.BaseUrl);
    _http.DefaultRequestHeaders.Add("X-Kite-Version", "3");
  }

  private void SetAuth(AccessToken accessToken)
  {
    _http.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("token", accessToken.Value);
  }

  public async Task<HttpResponseMessage> PostAsync(
      AccessToken accessToken,
      string url,
      Dictionary<string, string> form, CancellationToken ct = default)
  {
    if (!string.IsNullOrWhiteSpace(accessToken.Value))
      SetAuth(accessToken);

    return await _http.PostAsync(
        url,
        new FormUrlEncodedContent(form),
        ct);
  }

  public async Task<string> GetStringAsync(
      AccessToken accessToken,
      string url, CancellationToken ct = default)
  {
    SetAuth(accessToken);

    return await _http.GetStringAsync(url, ct);
  }
}
