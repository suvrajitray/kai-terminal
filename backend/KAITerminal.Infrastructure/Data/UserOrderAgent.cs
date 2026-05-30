namespace KAITerminal.Infrastructure.Data;

public class UserOrderAgent
{
    public string Username  { get; set; } = string.Empty;
    public string AgentUrl  { get; set; } = string.Empty;
    public string StaticIp  { get; set; } = string.Empty;
    public bool   IsEnabled { get; set; } = true;
}
