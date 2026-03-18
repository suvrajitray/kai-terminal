namespace KAITerminal.Broker;

/// <summary>
/// Registration-based factory. Consumers register creator delegates at startup;
/// this class resolves the correct creator by broker type at runtime.
/// </summary>
public sealed class BrokerClientFactory : IBrokerClientFactory
{
    private readonly IReadOnlyDictionary<string, Func<string, string?, IBrokerClient>> _creators;

    /// <param name="creators">
    /// Map of lowercase broker type key → factory func(accessToken, apiKey) → IBrokerClient.
    /// </param>
    public BrokerClientFactory(IReadOnlyDictionary<string, Func<string, string?, IBrokerClient>> creators)
        => _creators = creators;

    public IBrokerClient Create(string brokerType, string accessToken, string? apiKey = null)
    {
        var key = brokerType.ToLowerInvariant();
        if (!_creators.TryGetValue(key, out var creator))
            throw new ArgumentException($"Broker type '{brokerType}' is not registered.", nameof(brokerType));
        return creator(accessToken, apiKey);
    }
}
