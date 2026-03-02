using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models;

public sealed class UpstoxApiError
{
    [JsonPropertyName("errorCode")]
    public string? ErrorCode { get; init; }

    [JsonPropertyName("message")]
    public string? Message { get; init; }

    [JsonPropertyName("propertyPath")]
    public string? PropertyPath { get; init; }

    [JsonPropertyName("invalidValue")]
    public string? InvalidValue { get; init; }
}
