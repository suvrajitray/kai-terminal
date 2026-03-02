using KAITerminal.Upstox.Models.Enums;

namespace KAITerminal.Upstox.Models.Requests;

/// <summary>
/// Parameters for Feature 8: Place Order by Strike Type.
/// The SDK resolves the exact strike (ATM / OTM1-5 / ITM1-5) relative to the current
/// spot price and places the order on the matching option contract.
/// </summary>
public sealed class PlaceOrderByStrikeRequest
{
    /// <summary>
    /// Underlying instrument key, e.g. "NSE_INDEX|Nifty 50" or "NSE_INDEX|NIFTY BANK".
    /// </summary>
    public required string UnderlyingKey { get; init; }

    /// <summary>Expiry date in YYYY-MM-DD format, e.g. "2024-03-28".</summary>
    public required string ExpiryDate { get; init; }

    /// <summary>CE or PE.</summary>
    public required OptionType OptionType { get; init; }

    /// <summary>
    /// ATM, OTM1–OTM5, or ITM1–ITM5.
    /// For CE: OTMn = n strikes above ATM, ITMn = n strikes below ATM.
    /// For PE: OTMn = n strikes below ATM, ITMn = n strikes above ATM.
    /// </summary>
    public required StrikeType StrikeType { get; init; }

    public required int Quantity { get; init; }

    public required TransactionType TransactionType { get; init; }

    public OrderType OrderType { get; init; } = OrderType.Market;

    public Product Product { get; init; } = Product.Intraday;

    public Validity Validity { get; init; } = Validity.Day;

    public decimal Price { get; init; } = 0;

    public decimal TriggerPrice { get; init; } = 0;

    public bool IsAmo { get; init; } = false;

    public string? Tag { get; init; }

    /// <summary>v3 only — auto-slice if quantity exceeds freeze limit.</summary>
    public bool Slice { get; init; } = false;
}
