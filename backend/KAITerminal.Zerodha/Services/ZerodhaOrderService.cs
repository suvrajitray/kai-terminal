using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Http;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaOrderService : IBrokerOrderService
{
    private readonly ZerodhaHttpClient _http;
    private readonly ILogger<ZerodhaOrderService> _logger;

    public ZerodhaOrderService(ZerodhaHttpClient http, ILogger<ZerodhaOrderService> logger)
    {
        _http   = http;
        _logger = logger;
    }

    public async Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
    {
        var orders = await _http.GetOrdersAsync(ct);
        return orders.Select(o => new BrokerOrder
        {
            OrderId         = o.OrderId         ?? "",
            ExchangeOrderId = o.ExchangeOrderId ?? "",
            Exchange        = o.Exchange         ?? "",
            TradingSymbol   = o.TradingSymbol    ?? "",
            Product         = o.Product          ?? "",
            OrderType       = o.OrderType        ?? "",
            TransactionType = o.TransactionType  ?? "",
            Validity        = o.Validity         ?? "",
            Status          = o.Status           ?? "",
            StatusMessage   = o.StatusMessage    ?? "",
            Price           = o.Price,
            AveragePrice    = o.AveragePrice,
            Quantity        = o.Quantity,
            FilledQuantity  = o.FilledQuantity,
            PendingQuantity = o.PendingQuantity,
            Tag             = o.Tag,
            OrderTimestamp  = o.OrderTimestamp,
        }).ToList();
    }

    public Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        var exchange    = request.Exchange ?? InferExchange(request.InstrumentToken);
        var kiteProduct = ZerodhaProductMap.ToKite(request.Product, exchange);

        _logger.LogDebug(
            "ZerodhaOrderService.PlaceOrderAsync — symbol={Symbol} exchange={Exchange} kiteProduct={KiteProduct} orderType={OrderType} qty={Qty}",
            request.InstrumentToken, exchange, kiteProduct, request.OrderType, request.Quantity);

        return _http.PlaceOrderAsync(
            request.InstrumentToken,
            exchange,
            request.TransactionType.ToUpperInvariant(),
            kiteProduct,
            request.OrderType.ToUpperInvariant(),
            request.Quantity,
            request.Price,
            request.TriggerPrice,
            ct);
    }

    /// <summary>
    /// Infer Zerodha exchange from trading symbol when not explicitly provided.
    /// SENSEX and BANKEX are BSE F&amp;O (BFO); everything else is NSE F&amp;O (NFO).
    /// </summary>
    private static string InferExchange(string symbol)
    {
        var upper = symbol.ToUpperInvariant();
        return upper.StartsWith("SENSEX") || upper.StartsWith("BANKEX") ? "BFO" : "NFO";
    }

    public Task<string> CancelOrderAsync(string orderId, CancellationToken ct = default)
        => _http.CancelOrderAsync(orderId, ct);

    public Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<string>>([]);
}
