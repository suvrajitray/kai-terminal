using System.Text.Json.Serialization;

namespace KAITerminal.Api.Dto.Enums;

/// <summary>How long an order remains active.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrderValidity
{
    Day,
    IOC,
}
