using KAITerminal.Upstox.Models.Enums;

namespace KAITerminal.Upstox;

/// <summary>
/// Centralised mapping between unified broker product codes (I, D, NRML, MTF, CO)
/// and the Upstox <see cref="Product"/> enum.
/// </summary>
public static class UpstoxProductMap
{
    /// <summary>Unified broker product code → Upstox Product enum (used when placing orders).</summary>
    public static Product ToEnum(string product) => product.ToUpperInvariant() switch
    {
        "D" or "CNC" or "DELIVERY" or "NRML" => Product.Delivery,
        "MTF"                                  => Product.MTF,
        "CO" or "COVERORDER"                   => Product.CoverOrder,
        _                                      => Product.Intraday,
    };

    /// <summary>Upstox Product enum → unified broker product code (used when reading positions/orders).</summary>
    public static string FromEnum(Product p) => p switch
    {
        Product.Intraday   => "I",
        Product.Delivery   => "D",
        Product.MTF        => "MTF",
        Product.CoverOrder => "CO",
        _ => throw new ArgumentOutOfRangeException(nameof(p), p, null),
    };
}
