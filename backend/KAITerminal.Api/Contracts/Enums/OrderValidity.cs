using System.Text.Json.Serialization;

namespace KAITerminal.Api.Contracts.Enums;

/// <summary>How long an order remains active.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OrderValidity
{
    Day,
    IOC,
}
