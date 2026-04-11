using System.Text.Json.Serialization;

namespace KAITerminal.Api.Dto.Enums;

/// <summary>Execution type for an order.</summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TradeOrderType
{
    Market,
    Limit,
    StopLoss,
    StopLossMarket,
}
