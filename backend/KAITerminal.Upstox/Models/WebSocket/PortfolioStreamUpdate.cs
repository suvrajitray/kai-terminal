using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.WebSocket;

public sealed class PortfolioStreamUpdate
{
    /// <summary>Update category, e.g. "order", "position".</summary>
    [JsonPropertyName("update_type")]
    public string Type { get; init; } = "";

    [JsonPropertyName("order_id")]
    public string OrderId { get; init; } = "";

    [JsonPropertyName("status")]
    public string Status { get; init; } = "";

    [JsonPropertyName("status_message")]
    public string StatusMessage { get; init; } = "";

    [JsonPropertyName("trading_symbol")]
    public string TradingSymbol { get; init; } = "";
}
