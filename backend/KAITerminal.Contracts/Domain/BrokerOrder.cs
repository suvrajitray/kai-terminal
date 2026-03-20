namespace KAITerminal.Contracts.Domain;

/// <summary>Broker-agnostic order snapshot — minimal fields needed for status change detection and notifications.</summary>
public sealed record BrokerOrder
{
    public string OrderId       { get; init; } = "";
    public string TradingSymbol { get; init; } = "";
    /// <summary>Terminal states: complete, rejected, cancelled. Active: open, pending, etc.</summary>
    public string Status        { get; init; } = "";
    public string StatusMessage { get; init; } = "";
}
