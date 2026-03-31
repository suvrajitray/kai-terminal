namespace KAITerminal.Contracts.Domain;

/// <summary>Broker-agnostic position representation.</summary>
public sealed record BrokerPosition
{
    public string Exchange        { get; init; } = "";
    public string InstrumentToken { get; init; } = "";  // Broker-specific token string
    public string TradingSymbol   { get; init; } = "";
    public string Product         { get; init; } = "";  // "I" | "D" | "MTF"
    public int    Quantity        { get; init; }
    public int    BuyQuantity     { get; init; }
    public int    SellQuantity    { get; init; }
    public decimal AveragePrice   { get; init; }
    public decimal BuyPrice       { get; init; }
    public decimal SellPrice      { get; init; }
    /// <summary>Last traded price at the most recent REST position fetch.</summary>
    public decimal Ltp            { get; init; }
    public decimal Pnl            { get; init; }
    public decimal Unrealised     { get; init; }
    public decimal Realised       { get; init; }
    public decimal BuyValue       { get; init; }
    public decimal SellValue      { get; init; }
    /// <summary>Identifies the originating broker — "upstox" | "zerodha".</summary>
    public string? Broker         { get; init; }

    public bool IsOpen => Quantity != 0;
}
