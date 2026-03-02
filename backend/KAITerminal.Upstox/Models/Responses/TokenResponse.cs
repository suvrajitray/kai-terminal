using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.Responses;

public sealed class TokenResponse
{
    [JsonPropertyName("access_token")] public string AccessToken { get; init; } = "";
    [JsonPropertyName("extended_token")] public string? ExtendedToken { get; init; }
    [JsonPropertyName("token_type")] public string TokenType { get; init; } = "";
    [JsonPropertyName("email")] public string? Email { get; init; }
    [JsonPropertyName("user_id")] public string? UserId { get; init; }
    [JsonPropertyName("user_name")] public string? UserName { get; init; }
    [JsonPropertyName("user_type")] public string? UserType { get; init; }
    [JsonPropertyName("broker")] public string? Broker { get; init; }
    [JsonPropertyName("is_active")] public bool IsActive { get; init; }
    [JsonPropertyName("exchanges")] public IReadOnlyList<string>? Exchanges { get; init; }
    [JsonPropertyName("products")] public IReadOnlyList<string>? Products { get; init; }
    [JsonPropertyName("order_types")] public IReadOnlyList<string>? OrderTypes { get; init; }
}
