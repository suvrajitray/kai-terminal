namespace KAITerminal.Api.Data;

public class BrokerCredential
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;   // user email from JWT
    public string BrokerName { get; set; } = string.Empty; // "zerodha", "upstox", "dhan"
    public string ApiKey { get; set; } = string.Empty;
    public string ApiSecret { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
