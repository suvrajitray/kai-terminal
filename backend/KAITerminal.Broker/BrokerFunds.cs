namespace KAITerminal.Broker;

/// <summary>Broker-agnostic funds summary.</summary>
public sealed record BrokerFunds(decimal Available, decimal Used, decimal Payin = 0);
