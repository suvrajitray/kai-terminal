namespace KAITerminal.Contracts.Domain;

/// <summary>
/// Broker-agnostic product-type filter.
/// Upstox raw: "I" = intraday, "D" = delivery, "CO" = cover order, "MTF" = margin trading.
/// Zerodha raw: "MIS" = intraday, "NRML" = delivery, "CNC" = cash-and-carry (equity).
/// When a filter is active ("Intraday" or "Delivery"), CO/MTF/CNC are excluded — they
/// are neither pure intraday nor delivery positions and should not be managed by the risk engine.
/// </summary>
public static class ProductTypeFilter
{
    public static bool Matches(string product, string watchedProducts) =>
        watchedProducts switch
        {
            "Intraday" => product.Equals("I",   StringComparison.OrdinalIgnoreCase) ||
                          product.Equals("MIS", StringComparison.OrdinalIgnoreCase),
            "Delivery" => product.Equals("D",    StringComparison.OrdinalIgnoreCase) ||
                          product.Equals("NRML", StringComparison.OrdinalIgnoreCase),
            _          => true   // "All" → pass through everything
        };
}
