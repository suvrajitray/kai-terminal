using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.Requests;

namespace KAITerminal.Upstox.Services;

internal sealed class UpstoxMarginService : IBrokerMarginService
{
    private readonly UpstoxHttpClient _http;

    public UpstoxMarginService(UpstoxHttpClient http)
    {
        _http = http;
    }

    public async Task<BrokerMarginResult> GetRequiredMarginAsync(
        IEnumerable<BrokerMarginOrderItem> items, CancellationToken ct = default)
    {
        var upstoxItems = items.Select(i =>
            new MarginOrderItem(i.InstrumentToken, i.Quantity, i.Product, i.TransactionType));
        var r = await _http.GetRequiredMarginAsync(upstoxItems, ct);
        return new BrokerMarginResult(r.RequiredMargin, r.FinalMargin);
    }
}
