using System.Text.Json.Serialization;

namespace KAITerminal.Api.Contracts.Enums;

/// <summary>Broker-agnostic product type for API responses and requests.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ProductType
{
    Intraday,
    Delivery,
    Mtf,
    CoverOrder,
}
