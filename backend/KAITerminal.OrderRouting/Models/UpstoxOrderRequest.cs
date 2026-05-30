namespace KAITerminal.OrderRouting.Models;

public sealed record UpstoxOrderRequest(
    string  InstrumentToken,
    int     Quantity,
    string  TransactionType,
    string  OrderType,
    string  Product,
    string  Validity,
    decimal Price,
    decimal TriggerPrice,
    bool    Slice,
    string? Tag);
