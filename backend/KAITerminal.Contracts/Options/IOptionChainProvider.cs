namespace KAITerminal.Contracts.Options;

/// <summary>
/// Provides live option chain data (LTP, greeks, OI) for a given underlying + expiry.
/// Implementations are responsible for their own authentication.
/// </summary>
public interface IOptionChainProvider
{
    Task<IReadOnlyList<OptionChainEntry>> GetChainAsync(
        string underlyingKey, string expiryDate, CancellationToken ct = default);
}
