namespace KAITerminal.Contracts.Domain;

/// <summary>Broker-agnostic margin order item. InstrumentToken uses "EXCHANGE|SYMBOL" format.</summary>
public sealed record BrokerMarginOrderItem(
    string InstrumentToken,
    int    Quantity,
    string Product,
    string TransactionType);
