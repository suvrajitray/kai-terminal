namespace KAITerminal.Infrastructure.Data;

public sealed class RiskEngineLog
{
    public long    Id               { get; set; }
    public string  Username         { get; set; } = "";
    public string  BrokerType       { get; set; } = "";
    public string  EventType        { get; set; } = "";
    public decimal Mtm              { get; set; }
    public decimal? Sl              { get; set; }
    public decimal? Target          { get; set; }
    public decimal? TslFloor        { get; set; }
    public string?  InstrumentToken { get; set; }
    public int?     ShiftCount      { get; set; }
    public DateTimeOffset Timestamp { get; set; }
}
