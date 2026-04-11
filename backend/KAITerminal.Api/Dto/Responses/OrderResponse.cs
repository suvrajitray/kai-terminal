using KAITerminal.Api.Dto.Enums;

namespace KAITerminal.Api.Dto.Responses;

public sealed record OrderResponse
{
    public string  OrderId         { get; init; } = "";
    public string  ExchangeOrderId { get; init; } = "";
    public string  Exchange        { get; init; } = "";
    public string  TradingSymbol   { get; init; } = "";
    public ProductType     Product         { get; init; }
    public TradeOrderType  OrderType       { get; init; }
    public OrderSide       TransactionType { get; init; }
    public OrderValidity   Validity        { get; init; }
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
