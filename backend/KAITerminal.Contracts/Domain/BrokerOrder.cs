namespace KAITerminal.Contracts.Domain;

/// <summary>Broker-agnostic order snapshot.</summary>
public sealed record BrokerOrder
{
    public string  OrderId         { get; init; } = "";
    public string  ExchangeOrderId { get; init; } = "";
    public string  Exchange        { get; init; } = "";
    public string  TradingSymbol   { get; init; } = "";
    public string  Product         { get; init; } = "";
    public string  OrderType       { get; init; } = "";
    public string  TransactionType { get; init; } = "";
    public string  Validity        { get; init; } = "";
    /// <summary>Terminal states: complete, rejected, cancelled. Active: open, pending, etc.</summary>
    public string  Status          { get; init; } = "";
    public string  StatusMessage   { get; init; } = "";
    public decimal Price           { get; init; }
    public decimal AveragePrice    { get; init; }
    public int     Quantity        { get; init; }
    public int     FilledQuantity  { get; init; }
    public int     PendingQuantity { get; init; }
    public string? Tag             { get; init; }
    public string? OrderTimestamp  { get; init; }
}
