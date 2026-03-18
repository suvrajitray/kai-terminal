using Microsoft.Extensions.Logging;

namespace KAITerminal.Zerodha.Http;

/// <summary>
/// DelegatingHandler that injects the Kite Connect authorization header
/// (<c>token {api_key}:{access_token}</c>) per request using <see cref="ZerodhaTokenContext"/>.
/// </summary>
public sealed class ZerodhaAuthHandler : DelegatingHandler
{
    private readonly ILogger<ZerodhaAuthHandler> _logger;

    public ZerodhaAuthHandler(ILogger<ZerodhaAuthHandler> logger) => _logger = logger;

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var creds = ZerodhaTokenContext.Current;
        if (creds.HasValue)
        {
            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue(
                    "token", $"{creds.Value.ApiKey}:{creds.Value.AccessToken}");
        }
        else
        {
            _logger.LogWarning("ZerodhaAuthHandler: no credentials in context for {Uri}", request.RequestUri);
        }

        return await base.SendAsync(request, cancellationToken);
    }
}
