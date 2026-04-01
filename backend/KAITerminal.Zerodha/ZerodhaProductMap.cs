namespace KAITerminal.Zerodha;

/// <summary>
/// Centralised mapping between unified broker product codes (I, D, NRML)
/// and Kite Connect product codes (MIS, CNC, NRML).
/// </summary>
internal static class ZerodhaProductMap
{
    /// <summary>Kite product code → unified broker product code (used when reading positions/orders).</summary>
    public static string ToUnified(string? kiteProduct) => kiteProduct?.ToUpperInvariant() switch
    {
        "MIS"  => "I",
        "CNC"  => "D",
        "NRML" => "NRML",
        _      => kiteProduct ?? "",
    };

    /// <summary>
    /// Unified broker product code → Kite product code (used when placing orders or calling the margin API).
    /// F&O exchanges (NFO, BFO) map "D" to NRML; equity exchanges map it to CNC.
    /// </summary>
    public static string ToKite(string product, string exchange = "NFO")
    {
        var isFo = exchange.ToUpperInvariant() is "NFO" or "BFO";
        return product.ToUpperInvariant() switch
        {
            "I" or "MIS" or "INTRADAY"               => "MIS",
            "D" or "CNC" or "DELIVERY" when isFo     => "NRML",
            "D" or "CNC" or "DELIVERY"               => "CNC",
            _                                        => "NRML",
        };
    }
}
