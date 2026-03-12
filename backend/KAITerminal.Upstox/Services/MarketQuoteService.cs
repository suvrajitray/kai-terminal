using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

internal sealed class MarketQuoteService : IMarketQuoteService
{
    private readonly UpstoxHttpClient _http;

    public MarketQuoteService(UpstoxHttpClient http) => _http = http;

    public Task<IReadOnlyDictionary<string, MarketQuote>> GetMarketQuotesAsync(
        IEnumerable<string> instrumentKeys, CancellationToken ct = default)
        => _http.GetMarketQuotesAsync(instrumentKeys, ct);
}
