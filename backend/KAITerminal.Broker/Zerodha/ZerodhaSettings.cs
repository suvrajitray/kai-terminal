namespace KAITerminal.Broker.Zerodha;

public class ZerodhaSettings
{
  public string ApiKey { get; set; } = string.Empty;
  public string ApiSecret { get; set; } = string.Empty;
  public string AccessToken { get; set; } = string.Empty;
  public string BaseUrl { get; set; } = "https://api.kite.trade";
  public string WebSocketUrl { get; set; } = "wss://ws.kite.trade";
}
