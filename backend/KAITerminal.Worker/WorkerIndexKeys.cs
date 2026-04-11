namespace KAITerminal.Worker;

/// <summary>
/// Maps underlying symbol names to Upstox index keys used for option-chain lookups.
/// </summary>
internal static class WorkerIndexKeys
{
    /// <summary>Underlying name (from Kite CSV) → Upstox index feed key.</summary>
    public static readonly IReadOnlyDictionary<string, string> UnderlyingFeedKeys =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["NIFTY"]     = "NSE_INDEX|Nifty 50",
            ["BANKNIFTY"] = "NSE_INDEX|Nifty Bank",
            ["FINNIFTY"]  = "NSE_INDEX|Nifty Fin Service",
            ["SENSEX"]    = "BSE_INDEX|SENSEX",
            ["BANKEX"]    = "BSE_INDEX|BANKEX",
        };
}
