using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaMarginService : IZerodhaMarginService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaMarginService(ZerodhaHttpClient http) => _http = http;

    public Task<ZerodhaMarginResponse> GetRequiredMarginAsync(
        IEnumerable<ZerodhaMarginOrderItem> items, CancellationToken ct = default)
        => _http.GetRequiredMarginAsync(items, ct);
}
