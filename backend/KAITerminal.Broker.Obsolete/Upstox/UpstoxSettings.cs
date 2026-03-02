namespace KAITerminal.Broker.Upstox;

public class UpstoxSettings
{
    public string ApiKey { get; set; } = string.Empty;
    public string ApiSecret { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.upstox.com";
    public string OrderBaseUrl { get; set; } = "https://api-hft.upstox.com";
}
