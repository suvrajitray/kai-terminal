namespace KAITerminal.RiskEngine.Models;

/// <summary>Per-user identity + access token used by the Worker config source.</summary>
public sealed class UserConfig
{
    public string UserId { get; set; } = "";
    public string AccessToken { get; set; } = "";
}
