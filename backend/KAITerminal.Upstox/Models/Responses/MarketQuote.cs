using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.Responses;

public sealed record MarketQuote
{
    [JsonPropertyName("last_price")] public decimal LastPrice { get; init; }
    [JsonPropertyName("ohlc")] public OhlcValues? Ohlc { get; init; }
}

public sealed record OhlcValues
{
    [JsonPropertyName("open")]  public decimal Open  { get; init; }
    [JsonPropertyName("high")]  public decimal High  { get; init; }
    [JsonPropertyName("low")]   public decimal Low   { get; init; }
    [JsonPropertyName("close")] public decimal Close { get; init; }
}
