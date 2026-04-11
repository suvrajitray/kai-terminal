using System.Text.Json.Serialization;

namespace KAITerminal.Api.Dto.Enums;

/// <summary>Broker-agnostic product type for API responses and requests.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ProductType
{
    Intraday,
    Delivery,
    Mtf,
    CoverOrder,
}
