using KAITerminal.Upstox.Models.Enums;

namespace KAITerminal.Upstox.Models.Requests;

/// <summary>Parameters for placing a standard market or limit order (Feature 6).</summary>
public sealed class PlaceOrderRequest
{
    /// <summary>Upstox instrument key, e.g. "NSE_FO|52618".</summary>
    public required string InstrumentToken { get; init; }

    public required int Quantity { get; init; }

    public required TransactionType TransactionType { get; init; }

    public OrderType OrderType { get; init; } = OrderType.Market;

    public Product Product { get; init; } = Product.Intraday;

    public Validity Validity { get; init; } = Validity.Day;

    /// <summary>Limit price. Set to 0 for MARKET orders.</summary>
    public decimal Price { get; init; } = 0;

    /// <summary>Required for SL / SL-M order types.</summary>
    public decimal TriggerPrice { get; init; } = 0;

    public int DisclosedQuantity { get; init; } = 0;

    /// <summary>After-market order. Auto-detected during market hours when false.</summary>
    public bool IsAmo { get; init; } = false;

    /// <summary>Optional user-defined tag for the order.</summary>
    public string? Tag { get; init; }

    /// <summary>
    /// v3 only — when true the exchange auto-slices the order if quantity exceeds freeze limit.
    /// Ignored by PlaceOrderAsync (v2).
    /// </summary>
    public bool Slice { get; init; } = false;
}
