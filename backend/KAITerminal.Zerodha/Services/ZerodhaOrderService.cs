using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaOrderService : IZerodhaOrderService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaOrderService(ZerodhaHttpClient http) => _http = http;

    // Zerodha order history endpoint not yet implemented — returns empty list.
    public Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<BrokerOrder>>([]);

    public Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        // Parse "EXCHANGE|SYMBOL" token format into components
        var parts   = request.InstrumentToken.Split('|', 2);
        var exchange = parts.Length == 2 ? parts[0] : "NFO";
        var symbol   = parts.Length == 2 ? parts[1] : request.InstrumentToken;

        // F&O exchanges require NRML for delivery products; equity CNC for stock delivery
        var isFoExchange = exchange is "NFO" or "BFO";
        var kiteProduct = request.Product.ToUpperInvariant() switch
        {
            "I" or "MIS" or "INTRADAY"                        => "MIS",
            "D" or "CNC" or "DELIVERY" when isFoExchange      => "NRML",
            "D" or "CNC" or "DELIVERY"                        => "CNC",
            _                                                 => "NRML",
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
