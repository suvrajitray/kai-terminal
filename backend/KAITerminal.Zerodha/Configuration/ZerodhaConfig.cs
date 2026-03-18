namespace KAITerminal.Zerodha.Configuration;

public sealed class ZerodhaConfig
{
    public const string SectionName = "Zerodha";

    public string ApiBaseUrl   { get; set; } = "https://api.kite.trade";
    public string LoginBaseUrl { get; set; } = "https://kite.zerodha.com/connect/login";
    public TimeSpan HttpTimeout { get; set; } = TimeSpan.FromSeconds(30);
}
