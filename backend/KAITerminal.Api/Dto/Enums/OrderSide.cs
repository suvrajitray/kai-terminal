using System.Text.Json.Serialization;

namespace KAITerminal.Api.Dto.Enums;

/// <summary>Direction of a trade — buy or sell.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrderSide
{
    Buy,
    Sell,
}
