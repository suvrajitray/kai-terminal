namespace KAITerminal.OrderRouting.Models;

public sealed record ZerodhaOrderRequest(
    string   InstrumentToken,
    int      Quantity,
    string   TransactionType,
    string   Product,
    string   OrderType,
    decimal? Price,
    decimal? TriggerPrice,
    string?  Exchange,
    string?  Tag);
