using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

internal sealed class UpstoxMarginService : IUpstoxMarginService
{
    private readonly UpstoxHttpClient _http;

    public UpstoxMarginService(UpstoxHttpClient http)
    {
        _http = http;
    }

    public Task<MarginResponse> GetRequiredMarginAsync(
        IEnumerable<MarginOrderItem> items, CancellationToken ct = default)
        => _http.GetRequiredMarginAsync(items, ct);
}
