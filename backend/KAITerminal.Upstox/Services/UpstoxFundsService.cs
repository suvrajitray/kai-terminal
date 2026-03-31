using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

internal sealed class UpstoxFundsService : IUpstoxFundsService
{
    private readonly UpstoxHttpClient _http;

    public UpstoxFundsService(UpstoxHttpClient http)
    {
        _http = http;
    }

    public Task<FundsResponse> GetFundsAsync(CancellationToken ct = default)
        => _http.GetFundsAsync(ct);
}
