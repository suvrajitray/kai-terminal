using KAITerminal.Contracts.Streaming;

namespace KAITerminal.RiskEngine.Mapping;

/// <summary>
/// Default no-op token mapper — identity for all brokers.
/// Used in Upstox-only setups where the position token format already matches
/// the Upstox market-data feed token format.
/// </summary>
internal sealed class IdentityTokenMapper : ITokenMapper
{
    public Task EnsureReadyAsync(string brokerType, CancellationToken ct) => Task.CompletedTask;

    public IReadOnlyList<string> ToFeedTokens(string brokerType, IReadOnlyList<string> nativeTokens)
        => nativeTokens;

    public string ToNativeToken(string brokerType, string feedToken)
        => feedToken;
}
