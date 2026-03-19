using System.Text.Json.Serialization;

namespace KAITerminal.Api.Contracts.Enums;

/// <summary>Direction of a trade — buy or sell.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrderSide
{
    Buy,
    Sell,
}
