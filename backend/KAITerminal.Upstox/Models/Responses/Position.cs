using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.Responses;

public sealed class Position
{
    [JsonPropertyName("exchange")]
    public string Exchange { get; init; } = "";

    [JsonPropertyName("instrument_token")]
    public string InstrumentToken { get; init; } = "";

    [JsonPropertyName("trading_symbol")]
    public string TradingSymbol { get; init; } = "";

    /// <summary>Product type: I (Intraday), D (Delivery), CO, MTF.</summary>
    [JsonPropertyName("product")]
    public string Product { get; init; } = "";

    /// <summary>Net open quantity. Positive = long, negative = short.</summary>
    [JsonPropertyName("quantity")]
    public int Quantity { get; init; }

    [JsonPropertyName("overnight_quantity")]
    public int OvernightQuantity { get; init; }

    [JsonPropertyName("multiplier")]
    public decimal Multiplier { get; init; }

    [JsonPropertyName("average_price")]
    public decimal AveragePrice { get; init; }

    [JsonPropertyName("close_price")]
    public decimal ClosePrice { get; init; }

    [JsonPropertyName("last_price")]
    public decimal LastPrice { get; init; }

    [JsonPropertyName("value")]
    public decimal Value { get; init; }

    [JsonPropertyName("buy_price")]
    public decimal BuyPrice { get; init; }

    [JsonPropertyName("buy_value")]
    public decimal BuyValue { get; init; }

    [JsonPropertyName("sell_price")]
    public decimal SellPrice { get; init; }

    [JsonPropertyName("sell_value")]
    public decimal SellValue { get; init; }

    /// <summary>Total P&amp;L (realised + unrealised).</summary>
    [JsonPropertyName("pnl")]
    public decimal Pnl { get; init; }

    /// <summary>Unrealised P&amp;L on still-open quantity.</summary>
    [JsonPropertyName("unrealised")]
    public decimal Unrealised { get; init; }

    /// <summary>Realised P&amp;L from closed-out portions.</summary>
    [JsonPropertyName("realised")]
    public decimal Realised { get; init; }

    [JsonPropertyName("day_buy_quantity")]
    public int DayBuyQuantity { get; init; }

    [JsonPropertyName("day_buy_price")]
    public decimal DayBuyPrice { get; init; }

    [JsonPropertyName("day_buy_value")]
    public decimal DayBuyValue { get; init; }

    [JsonPropertyName("day_sell_quantity")]
    public int DaySellQuantity { get; init; }

    [JsonPropertyName("day_sell_price")]
    public decimal DaySellPrice { get; init; }

    [JsonPropertyName("day_sell_value")]
    public decimal DaySellValue { get; init; }

    [JsonPropertyName("overnight_buy_quantity")]
    public int OvernightBuyQuantity { get; init; }

    [JsonPropertyName("overnight_buy_amount")]
    public decimal OvernightBuyAmount { get; init; }

    [JsonPropertyName("overnight_sell_quantity")]
    public int OvernightSellQuantity { get; init; }

    [JsonPropertyName("overnight_sell_amount")]
    public decimal OvernightSellAmount { get; init; }

    /// <summary>True when the position has a non-zero open quantity.</summary>
    [JsonIgnore]
    public bool IsOpen => Quantity != 0;
}
