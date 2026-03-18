using KAITerminal.Contracts.Options;

namespace KAITerminal.Contracts.Broker;

/// <summary>
/// Pluggable option contract fetcher — one implementation per broker SDK.
/// Registered in DI by each broker's service registration; consumed by <c>MasterDataService</c>.
/// </summary>
public interface IOptionContractProvider
{
    /// <summary>Identifies the broker — "upstox" | "zerodha".</summary>
    string BrokerType { get; }

    /// <summary>Fetch all current-year CE/PE contracts for the supported underlyings.</summary>
    Task<IReadOnlyList<IndexContracts>> GetContractsAsync(
        string accessToken, string? apiKey, CancellationToken ct);
}
