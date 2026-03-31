using KAITerminal.Broker;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaAuthService : IBrokerAuthService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaAuthService(ZerodhaHttpClient http) => _http = http;

    public Task<string> GenerateTokenAsync(
        string clientId,
        string clientSecret,
        string authorizationCode,
        string? redirectUri = null,
        CancellationToken ct = default)
        => _http.ExchangeTokenAsync(clientId, clientSecret, authorizationCode, ct);
}
