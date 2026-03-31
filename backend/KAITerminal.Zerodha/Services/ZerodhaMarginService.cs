using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaMarginService : IBrokerMarginService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaMarginService(ZerodhaHttpClient http) => _http = http;

    public async Task<BrokerMarginResult> GetRequiredMarginAsync(
        IEnumerable<BrokerMarginOrderItem> items, CancellationToken ct = default)
    {
        var kiteItems = items.Select(i =>
        {
            var parts    = i.InstrumentToken.Split('|', 2);
            var exchange = parts.Length == 2 ? parts[0] : "NFO";
            var symbol   = parts.Length == 2 ? parts[1] : i.InstrumentToken;
            return new ZerodhaMarginOrderItem(symbol, exchange, i.TransactionType, i.Product, i.Quantity);
        });
        var r = await _http.GetRequiredMarginAsync(kiteItems, ct);
        return new BrokerMarginResult(r.RequiredMargin, r.FinalMargin);
    }
}

internal sealed record ZerodhaMarginOrderItem(
    string TradingSymbol,
    string Exchange,
    string TransactionType,
    string Product,
    int    Quantity);

internal sealed record ZerodhaMarginResponse(decimal RequiredMargin, decimal FinalMargin);
