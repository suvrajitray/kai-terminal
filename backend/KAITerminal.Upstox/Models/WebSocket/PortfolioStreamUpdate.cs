using System.Text.Json;
using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.WebSocket;

public sealed class PortfolioStreamUpdate
{
    /// <summary>Update category, e.g. "order_update", "position_update".</summary>
    [JsonPropertyName("type")]
    public string Type { get; init; } = "";

    /// <summary>Raw JSON payload for the update. Inspect <see cref="Type"/> to determine the schema.</summary>
    [JsonPropertyName("data")]
    public JsonElement? Data { get; init; }
}
