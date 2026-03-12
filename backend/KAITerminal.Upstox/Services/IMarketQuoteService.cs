using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

public interface IMarketQuoteService
{
    Task<IReadOnlyDictionary<string, MarketQuote>> GetMarketQuotesAsync(
        IEnumerable<string> instrumentKeys, CancellationToken ct = default);
}
