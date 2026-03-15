namespace KAITerminal.Upstox.Models.Responses;

public sealed record InstrumentSearchResult
{
    public string InstrumentKey  { get; init; } = "";
    public string TradingSymbol  { get; init; } = "";
    public string Name           { get; init; } = "";
    public string Exchange       { get; init; } = "";
    public string InstrumentType { get; init; } = "";
}
