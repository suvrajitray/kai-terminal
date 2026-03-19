using System.Text.Json.Serialization;

namespace KAITerminal.Api.Contracts.Enums;

/// <summary>Execution type for an order.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TradeOrderType
{
    Market,
    Limit,
    StopLoss,
    StopLossMarket,
}
