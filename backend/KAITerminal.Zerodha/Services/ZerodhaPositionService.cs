using KAITerminal.Contracts.Domain;
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

        var openList = open.ToList();

        // Exit short positions (qty < 0, BUY-to-close) before long positions (qty > 0, SELL-to-close)
        var shorts = openList.Where(p => p.Quantity < 0).ToList();
        var longs  = openList.Where(p => p.Quantity > 0).ToList();

        await Task.WhenAll(shorts.Select(p => _http.PlaceOrderAsync(
            p.TradingSymbol, p.Exchange, "BUY", MapProductBack(p.Product), "MARKET", Math.Abs(p.Quantity), null, ct)));

        await Task.WhenAll(longs.Select(p => _http.PlaceOrderAsync(
            p.TradingSymbol, p.Exchange, "SELL", MapProductBack(p.Product), "MARKET", Math.Abs(p.Quantity), null, ct)));
    }

    public async Task ExitPositionAsync(
        string instrumentToken, string product, CancellationToken ct = default)
    {
        var positions = await _http.GetPositionsAsync(ct);
        var pos = positions.FirstOrDefault(p =>
            p.InstrumentToken.Equals(instrumentToken, StringComparison.OrdinalIgnoreCase));

        if (pos is null || pos.Quantity == 0) return;

        var txType      = pos.Quantity > 0 ? "SELL" : "BUY";
        var quantity    = Math.Abs(pos.Quantity);
        var kiteProduct = MapProductBack(pos.Product);   // use raw Kite product, not the API-mapped param
        await _http.PlaceOrderAsync(pos.TradingSymbol, pos.Exchange, txType, kiteProduct, "MARKET", quantity, null, ct);
    }

    public async Task ConvertPositionAsync(
        string instrumentToken, string oldProduct, int quantity, CancellationToken ct = default)
    {
        var positions = await _http.GetPositionsAsync(ct);
        var pos = positions.FirstOrDefault(p =>
            p.InstrumentToken.Equals(instrumentToken, StringComparison.OrdinalIgnoreCase));

        if (pos is null || pos.Quantity == 0) return;

        var txType   = pos.Quantity >= 0 ? "BUY" : "SELL";
        var kiteOld  = MapProductBack(pos.Product);   // e.g. "MIS" or "NRML"
        var isFo     = pos.Exchange.Equals("NFO", StringComparison.OrdinalIgnoreCase)
                    || pos.Exchange.Equals("BFO", StringComparison.OrdinalIgnoreCase);
        var kiteNew  = kiteOld == "MIS" ? (isFo ? "NRML" : "CNC") : "MIS";
        var posType  = kiteOld == "MIS" ? "day" : "overnight";

        await _http.ConvertPositionAsync(
            pos.TradingSymbol, pos.Exchange, txType, posType, kiteOld, kiteNew, quantity, ct);
    }

    /// <summary>Map unified product codes back to Kite product codes for order placement.</summary>
    private static string MapProductBack(string product) => product.ToUpperInvariant() switch
    {
        "I" or "MIS" or "INTRADAY"       => "MIS",
        "D" or "CNC" or "DELIVERY"       => "CNC",
        "NRML"                           => "NRML",
        _                                => "NRML",
    };
}
