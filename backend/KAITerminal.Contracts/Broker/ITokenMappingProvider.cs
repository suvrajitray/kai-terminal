namespace KAITerminal.Contracts.Broker;

/// <summary>
/// Provides native broker instrument tokens paired with their exchange-level token,
/// enabling <c>CrossBrokerTokenMapper</c> to construct Upstox feed tokens directly
/// without any Upstox API calls.
///
/// One implementation per non-Upstox broker SDK. <c>CrossBrokerTokenMapper</c>
/// injects <c>IEnumerable&lt;ITokenMappingProvider&gt;</c> and handles all of them —
/// adding a new broker (Dhan, etc.) requires only registering its implementation here.
/// </summary>
public interface ITokenMappingProvider
{
    /// <summary>Identifies the broker — e.g. "zerodha", "dhan". Never "upstox".</summary>
    string BrokerType { get; }

    /// <summary>
    /// Returns the native instrument token paired with its exchange-level token for
    /// every option contract the broker supports. The caller constructs the Upstox
    /// feed token directly as "{prefix}|{exchangeToken}" — no Upstox API call needed.
    ///
    /// Implementations using public endpoints (e.g. Zerodha CSV) may ignore
    /// accessToken and apiKey entirely.
    /// </summary>
    Task<IReadOnlyList<NativeContractKey>> GetNativeContractKeysAsync(
        string accessToken, string? apiKey, CancellationToken ct);
}

/// <summary>
/// One option contract from a non-Upstox broker, with the universal
/// exchange-level token that directly maps to an Upstox feed token.
/// </summary>
public sealed record NativeContractKey(
    string Segment,         // broker segment, e.g. "NFO-OPT" | "BFO-OPT" — maps to Upstox prefix
    string ExchangeToken,   // exchange-level token — same value across all brokers, e.g. "885247"
    string TradingSymbol    // trading symbol used as the native key, e.g. "NIFTY2641320700PE"
);
