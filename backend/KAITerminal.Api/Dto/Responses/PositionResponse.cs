using KAITerminal.Api.Dto.Enums;

namespace KAITerminal.Api.Dto.Responses;

public sealed record PositionResponse
{
    public string  Exchange        { get; init; } = "";
    public string  InstrumentToken { get; init; } = "";
    public string  TradingSymbol   { get; init; } = "";
    public ProductType Product      { get; init; }
    public int     Quantity        { get; init; }
    public int     BuyQuantity     { get; init; }
    public int     SellQuantity    { get; init; }
    public decimal AveragePrice    { get; init; }
    public decimal Ltp             { get; init; }
    public decimal Pnl             { get; init; }
    public decimal Unrealised      { get; init; }
    public decimal Realised        { get; init; }
    public decimal BuyPrice        { get; init; }
    public decimal SellPrice       { get; init; }
    public decimal BuyValue        { get; init; }
    public decimal SellValue       { get; init; }
    public string  Broker          { get; init; } = "";  // "upstox" | "zerodha"
    public bool    IsOpen          { get; init; }
}
