namespace KAITerminal.Contracts.Domain;

/// <summary>Broker-agnostic margin calculation result.</summary>
public sealed record BrokerMarginResult(decimal RequiredMargin, decimal FinalMargin);
