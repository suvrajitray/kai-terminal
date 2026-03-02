using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.Responses;

public sealed class Order
{
    [JsonPropertyName("order_id")]
    public string OrderId { get; init; } = "";

    [JsonPropertyName("exchange_order_id")]
    public string ExchangeOrderId { get; init; } = "";

    [JsonPropertyName("exchange")]
    public string Exchange { get; init; } = "";

    [JsonPropertyName("instrument_token")]
    public string InstrumentToken { get; init; } = "";

    [JsonPropertyName("trading_symbol")]
    public string TradingSymbol { get; init; } = "";

    [JsonPropertyName("product")]
    public string Product { get; init; } = "";

    [JsonPropertyName("order_type")]
    public string OrderType { get; init; } = "";

    [JsonPropertyName("transaction_type")]
    public string TransactionType { get; init; } = "";

    [JsonPropertyName("validity")]
    public string Validity { get; init; } = "";

    [JsonPropertyName("variety")]
    public string Variety { get; init; } = "";

    /// <summary>
    /// Order status. Terminal states: complete, rejected, cancelled.
    /// Active states: open, trigger pending, pending, validation pending, open pending.
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; init; } = "";

    [JsonPropertyName("status_message")]
    public string StatusMessage { get; init; } = "";

    [JsonPropertyName("price")]
    public decimal Price { get; init; }

    [JsonPropertyName("trigger_price")]
    public decimal TriggerPrice { get; init; }

    [JsonPropertyName("quantity")]
    public int Quantity { get; init; }

    [JsonPropertyName("filled_quantity")]
    public int FilledQuantity { get; init; }

    [JsonPropertyName("pending_quantity")]
    public int PendingQuantity { get; init; }

    [JsonPropertyName("disclosed_quantity")]
    public int DisclosedQuantity { get; init; }

    [JsonPropertyName("average_price")]
    public decimal AveragePrice { get; init; }

    [JsonPropertyName("placed_by")]
    public string PlacedBy { get; init; } = "";

    [JsonPropertyName("tag")]
    public string? Tag { get; init; }

    [JsonPropertyName("is_amo")]
    public bool IsAmo { get; init; }

    [JsonPropertyName("order_timestamp")]
    public string? OrderTimestamp { get; init; }

    [JsonPropertyName("exchange_timestamp")]
    public string? ExchangeTimestamp { get; init; }

    private static readonly HashSet<string> TerminalStatuses =
        new(StringComparer.OrdinalIgnoreCase) { "complete", "rejected", "cancelled" };

    /// <summary>True when the order can still be cancelled.</summary>
    [JsonIgnore]
    public bool IsCancellable => !TerminalStatuses.Contains(Status);
}
