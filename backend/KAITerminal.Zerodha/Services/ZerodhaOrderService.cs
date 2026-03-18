using KAITerminal.Broker;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

public sealed class ZerodhaOrderService : IZerodhaOrderService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaOrderService(ZerodhaHttpClient http) => _http = http;

    public Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        // Parse "EXCHANGE|SYMBOL" token format into components
        var parts   = request.InstrumentToken.Split('|', 2);
        var exchange = parts.Length == 2 ? parts[0] : "NFO";
        var symbol   = parts.Length == 2 ? parts[1] : request.InstrumentToken;

        var kiteProduct = request.Product.ToUpperInvariant() switch
        {
            "I" or "MIS"  => "MIS",
            "D" or "CNC"  => "CNC",
            _             => "NRML",
        };

        return _http.PlaceOrderAsync(
            symbol, exchange,
            request.TransactionType.ToUpperInvariant(),
            kiteProduct,
            request.OrderType.ToUpperInvariant(),
            request.Quantity,
            request.Price,
            ct);
    }
}
