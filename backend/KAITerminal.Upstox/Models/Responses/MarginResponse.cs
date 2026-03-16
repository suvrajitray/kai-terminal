using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.Responses;

public sealed class MarginResponse
{
    [JsonPropertyName("required_margin")] public decimal RequiredMargin { get; init; }
    [JsonPropertyName("final_margin")]    public decimal FinalMargin    { get; init; }
}
