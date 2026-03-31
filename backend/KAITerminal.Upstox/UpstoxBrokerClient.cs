using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;

namespace KAITerminal.Broker.Adapters;

/// <summary>
/// Adapts <see cref="UpstoxClient"/> to the broker-agnostic <see cref="IBrokerClient"/> interface.
/// Each instance is token-scoped — wraps every call in <c>UpstoxTokenContext.Use(token)</c>.
/// Maps Upstox-internal types to <see cref="KAITerminal.Contracts"/> types at the boundary.
/// </summary>
public sealed class UpstoxBrokerClient : IBrokerClient
{
    private readonly UpstoxClient _upstox;
    private readonly string _accessToken;

    public UpstoxBrokerClient(UpstoxClient upstox, string accessToken)
    {
        ArgumentNullException.ThrowIfNull(upstox);
        ArgumentException.ThrowIfNullOrEmpty(accessToken);
        _upstox = upstox;
        _accessToken = accessToken;
    }

    public string BrokerType => "upstox";

    public IDisposable UseToken() => UpstoxTokenContext.Use(_accessToken);

    public async Task<IReadOnlyList<Position>> GetAllPositionsAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        var upstoxPositions = await _upstox.GetAllPositionsAsync(ct);
        return upstoxPositions.Select(MapPosition).ToList().AsReadOnly();
    }

    public async Task<decimal> GetTotalMtmAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _upstox.GetTotalMtmAsync(ct);
    }

    public async Task ExitAllPositionsAsync(IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default)
    {
        using var _ = UseToken();
        await _upstox.ExitAllPositionsAsync(exchanges, ct);
    }

    public async Task ExitPositionAsync(string instrumentToken, string product, CancellationToken ct = default)
    {
        using var _ = UseToken();
        await _upstox.ExitPositionAsync(instrumentToken, product, ct);
    }

    public async Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        var orders = await _upstox.GetAllOrdersAsync(ct);
        return orders.Select(o => new BrokerOrder
        {
            OrderId       = o.OrderId,
            TradingSymbol = o.TradingSymbol,
            Status        = o.Status,
            StatusMessage = o.StatusMessage,
        }).ToList().AsReadOnly();
    }

    public async Task PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        using var _ = UseToken();

        var txType = request.TransactionType.Equals("BUY", StringComparison.OrdinalIgnoreCase)
            ? TransactionType.Buy : TransactionType.Sell;

        var orderType = request.OrderType.Equals("LIMIT", StringComparison.OrdinalIgnoreCase)
            ? OrderType.Limit : OrderType.Market;

        var product = request.Product.ToUpperInvariant() switch
        {
            "D" or "CNC" or "DELIVERY" => Product.Delivery,
            "MTF"                       => Product.MTF,
            "CO"                        => Product.CoverOrder,
            _                           => Product.Intraday,   // "I", "MIS", "NRML" etc.
        };

        await _upstox.PlaceOrderV3Async(new PlaceOrderRequest
        {
            InstrumentToken = request.InstrumentToken,
            Quantity        = request.Quantity,
            TransactionType = txType,
            OrderType       = orderType,
            Product         = product,
            Price           = request.Price ?? 0,
            Slice           = true,
        }, ct);
    }

    public async Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
    {
        using var _ = UseToken();
        return await _upstox.GetFundsAsync(ct);
    }

    // ── Position mapping ─────────────────────────────────────────────────────

    private static Position MapPosition(KAITerminal.Upstox.Models.Responses.Position p) => new()
    {
        Exchange        = p.Exchange,
        InstrumentToken = p.InstrumentToken,
        TradingSymbol   = p.TradingSymbol,
        Product         = p.Product,
        Quantity        = p.Quantity,
        BuyQuantity     = p.DayBuyQuantity,
        SellQuantity    = p.DaySellQuantity,
        // sell_price / buy_price are the actual weighted avg entry prices per trade direction.
        AveragePrice    = p.Quantity < 0
                            ? (p.SellPrice != 0 ? p.SellPrice : p.ClosePrice)
                            : (p.BuyPrice  != 0 ? p.BuyPrice  : p.ClosePrice),
        BuyPrice        = p.BuyPrice,
        SellPrice       = p.SellPrice,
        Ltp             = p.LastPrice,
        Pnl             = p.Pnl,
        Unrealised      = p.Unrealised,
        Realised        = p.Realised,
        BuyValue        = p.BuyValue,
        SellValue       = p.SellValue,
        Broker          = "upstox",
    };
}
