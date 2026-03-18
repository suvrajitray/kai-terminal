using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.Responses;

public sealed class FundsResponse
{
    [JsonPropertyName("available_margin")] public decimal AvailableMargin { get; init; }
    [JsonPropertyName("used_margin")]      public decimal UsedMargin      { get; init; }
    [JsonPropertyName("payin_amount")]     public decimal PayinAmount     { get; init; }
}
