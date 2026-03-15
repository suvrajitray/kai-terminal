namespace KAITerminal.Upstox.Models.Responses;

public sealed record CandleData
{
    public DateTime Timestamp { get; init; }
    public decimal  Open      { get; init; }
    public decimal  High      { get; init; }
    public decimal  Low       { get; init; }
    public decimal  Close     { get; init; }
    public long     Volume    { get; init; }
    public long     Oi        { get; init; }
}
