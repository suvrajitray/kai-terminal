namespace KAITerminal.Contracts.Options;

/// <summary>A single strike row from the option chain (call + put side).</summary>
public sealed class OptionChainEntry
{
    public string  Expiry              { get; init; } = "";
    public decimal Pcr                 { get; init; }
    public decimal StrikePrice         { get; init; }
    public string  UnderlyingKey       { get; init; } = "";
    public decimal UnderlyingSpotPrice { get; init; }
    public OptionSide? CallOptions     { get; init; }
    public OptionSide? PutOptions      { get; init; }
}

public sealed class OptionSide
{
    public string         InstrumentKey { get; init; } = "";
    public OptionMarketData? MarketData { get; init; }
    public OptionGreeks?  OptionGreeks  { get; init; }
}

public sealed class OptionMarketData
{
    public decimal Ltp        { get; init; }
    public decimal Volume     { get; init; }
    public decimal Oi         { get; init; }
    public decimal PrevOi     { get; init; }
    public decimal ClosePrice { get; init; }
    public decimal BidPrice   { get; init; }
    public decimal BidQty     { get; init; }
    public decimal AskPrice   { get; init; }
    public decimal AskQty     { get; init; }
}

public sealed class OptionGreeks
{
    public decimal Vega  { get; init; }
    public decimal Theta { get; init; }
    public decimal Gamma { get; init; }
    public decimal Delta { get; init; }
    public decimal Iv    { get; init; }
    /// <summary>Probability of Profit (%).</summary>
    public decimal Pop   { get; init; }
}
