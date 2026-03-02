using System.Net.Http.Headers;
using KAITerminal.Upstox.Configuration;
using Microsoft.Extensions.Options;

namespace KAITerminal.Upstox.Http;

/// <summary>
/// Injects the Upstox Bearer token into every outgoing HTTP request.
/// Priority: <see cref="UpstoxTokenContext.Current"/> (per-call) → <see cref="UpstoxConfig.AccessToken"/> (config).
/// </summary>
internal sealed class UpstoxAuthHandler : DelegatingHandler
{
    private readonly IOptions<UpstoxConfig> _options;

    public UpstoxAuthHandler(IOptions<UpstoxConfig> options) => _options = options;

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var token = UpstoxTokenContext.Current ?? _options.Value.AccessToken;
        if (token is not null)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return base.SendAsync(request, cancellationToken);
    }
}
