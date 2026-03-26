using KAITerminal.MarketData.Models;

namespace KAITerminal.MarketData.Services;

public interface IMarketQuoteService
{
    Task<IReadOnlyDictionary<string, MarketQuote>> GetMarketQuotesAsync(
        IEnumerable<string> instrumentKeys, CancellationToken ct = default);
}
