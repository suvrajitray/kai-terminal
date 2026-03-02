using KAITerminal.Upstox.Models.Enums;

namespace KAITerminal.Upstox.Models.Requests;

/// <summary>
/// Parameters for Feature 7: Place Order by Option Price.
/// The SDK searches the option chain using <see cref="PriceSearchMode"/> to find a matching
/// strike and places the order on it.
/// </summary>
public sealed class PlaceOrderByOptionPriceRequest
{
    /// <summary>
    /// Underlying instrument key, e.g. "NSE_INDEX|Nifty 50" or "NSE_INDEX|NIFTY BANK".
    /// </summary>
    public required string UnderlyingKey { get; init; }

    /// <summary>Expiry date in YYYY-MM-DD format, e.g. "2024-03-28".</summary>
    public required string ExpiryDate { get; init; }

    /// <summary>CE or PE.</summary>
    public required OptionType OptionType { get; init; }

    /// <summary>Target option premium (LTP) to match.</summary>
    public required decimal TargetPremium { get; init; }

    /// <summary>
    /// How to search the option chain for a strike matching <see cref="TargetPremium"/>.
    /// <list type="bullet">
    ///   <item><see cref="PriceSearchMode.Nearest"/> — strike with LTP closest to target (default).</item>
    ///   <item><see cref="PriceSearchMode.GreaterThan"/> — lowest LTP strictly above target.</item>
    ///   <item><see cref="PriceSearchMode.LessThan"/> — highest LTP strictly below target.</item>
    /// </list>
    /// </summary>
    public PriceSearchMode PriceSearchMode { get; init; } = PriceSearchMode.Nearest;

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
