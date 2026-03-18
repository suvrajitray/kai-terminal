namespace KAITerminal.Infrastructure.Data;

public class OptionContractCache
{
    public int Id { get; set; }
    public string Broker { get; set; } = "";         // "upstox" | "zerodha"
    public string Data { get; set; } = "";           // JSON: IndexContracts[]
    public DateOnly LastUpdatedDate { get; set; }    // IST date — "for the day" gate
    public DateTime UpdatedAt { get; set; }
}
