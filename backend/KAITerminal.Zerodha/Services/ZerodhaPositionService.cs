using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

public sealed class ZerodhaPositionService : IZerodhaPositionService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaPositionService(ZerodhaHttpClient http) => _http = http;

    public Task<IReadOnlyList<Position>> GetAllPositionsAsync(CancellationToken ct = default)
        => _http.GetPositionsAsync(ct);

    public async Task<decimal> GetTotalMtmAsync(CancellationToken ct = default)
    {
        var positions = await _http.GetPositionsAsync(ct);
        return positions.Sum(p => p.Pnl);
    }

    public async Task ExitAllPositionsAsync(
        IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default)
    {
        var positions = await _http.GetPositionsAsync(ct);
        var open = positions.Where(p => p.Quantity != 0);

        if (exchanges?.Count > 0)
        {
            var set = exchanges.Select(e => e.ToUpperInvariant()).ToHashSet();
            open = open.Where(p => set.Contains(p.Exchange.ToUpperInvariant()));
        }

        var tasks = open.Select(p =>
        {
            var txType   = p.Quantity > 0 ? "SELL" : "BUY";
            var quantity = Math.Abs(p.Quantity);
            var symbol   = p.TradingSymbol;
            var exchange = p.Exchange;
            var product  = MapProductBack(p.Product);
            return _http.PlaceOrderAsync(symbol, exchange, txType, product, "MARKET", quantity, null, ct);
        });

        await Task.WhenAll(tasks);
    }

    public async Task ExitPositionAsync(
        string instrumentToken, string product, CancellationToken ct = default)
    {
        var positions = await _http.GetPositionsAsync(ct);
        var pos = positions.FirstOrDefault(p =>
            p.InstrumentToken.Equals(instrumentToken, StringComparison.OrdinalIgnoreCase));

        if (pos is null || pos.Quantity == 0) return;

        var txType   = pos.Quantity > 0 ? "SELL" : "BUY";
        var quantity = Math.Abs(pos.Quantity);
        var kiteProduct = MapProductBack(product);
        await _http.PlaceOrderAsync(pos.TradingSymbol, pos.Exchange, txType, kiteProduct, "MARKET", quantity, null, ct);
    }

    /// <summary>Map Upstox product back to Kite product code.</summary>
    private static string MapProductBack(string upstoxProduct) => upstoxProduct.ToUpperInvariant() switch
    {
        "I"   => "MIS",
        "D"   => "CNC",
        "MIS" => "MIS",
        "CNC" => "CNC",
        _     => "NRML",
    };
}
