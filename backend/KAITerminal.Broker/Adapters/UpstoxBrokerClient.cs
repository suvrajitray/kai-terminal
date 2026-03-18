using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Upstox.Services;

namespace KAITerminal.Broker.Adapters;

/// <summary>
/// Adapts <see cref="UpstoxClient"/> to the broker-agnostic <see cref="IBrokerClient"/> interface.
/// Each instance is token-scoped — wraps every call in <c>UpstoxTokenContext.Use(token)</c>.
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
        return await _upstox.GetAllPositionsAsync(ct);
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
        var funds = await _upstox.GetFundsAsync(ct);
        return new BrokerFunds(funds.AvailableMargin, funds.UsedMargin, funds.PayinAmount);
    }

    public IMarketDataStreamer CreateMarketDataStreamer() => _upstox.CreateMarketDataStreamer();
    public IPortfolioStreamer  CreatePortfolioStreamer()  => _upstox.CreatePortfolioStreamer();
}
