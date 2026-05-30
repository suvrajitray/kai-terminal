using System.Text.Json.Serialization;
using KAITerminal.Upstox.Models;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Http;

internal sealed partial class UpstoxHttpClient
{
    public Task<IReadOnlyList<Order>> GetAllOrdersAsync(CancellationToken ct = default)
        => GetListAsync<Order>("UpstoxApi", "/v2/order/retrieve-all", ct);

    public async Task<PlaceOrderV3Result> PlaceOrderV3Async(PlaceOrderRequest req, CancellationToken ct = default)
    {
        var dto = new PlaceOrderDtoV3
        {
            Quantity = req.Quantity,
            Product = UpstoxProductMap.FromEnum(req.Product),
            Validity = ToValidityString(req.Validity),
            Price = req.Price,
            Tag = req.Tag,
            InstrumentToken = req.InstrumentToken,
            OrderType = ToOrderTypeString(req.OrderType),
            TransactionType = ToTransactionTypeString(req.TransactionType),
            DisclosedQuantity = req.DisclosedQuantity,
            TriggerPrice = req.TriggerPrice,
            IsAmo = req.IsAmo,
            Slice = req.Slice
        };
        var (raw, latency) = await PostWithMetaAsync<PlaceOrderRawV3>("UpstoxHft", "/v3/order/place", dto, ct);
        return new PlaceOrderV3Result
        {
            OrderIds = raw.OrderIds ?? [],
            Latency = latency
        };
    }

    public async Task<(string OrderId, int Latency)> CancelOrderV3Async(string orderId, CancellationToken ct = default)
    {
        var client = _factory.CreateClient("UpstoxHft");
        var response = await client.DeleteAsync($"/v3/order/cancel?order_id={Uri.EscapeDataString(orderId)}", ct);
        var (raw, latency) = await HandleResponseWithMetaAsync<OrderIdRaw>(response, ct);
        return (raw.OrderId ?? orderId, latency);
    }

    // ── Order enum → API string mappings ────────────────────────────────────

    internal static string ToOrderTypeString(OrderType t) => t switch
    {
        OrderType.Market => "MARKET",
        OrderType.Limit  => "LIMIT",
        OrderType.SL     => "SL",
        OrderType.SLM    => "SL-M",
        _ => throw new ArgumentOutOfRangeException(nameof(t), t, null)
    };

    internal static string ToTransactionTypeString(TransactionType t) => t switch
    {
        TransactionType.Buy  => "BUY",
        TransactionType.Sell => "SELL",
        _ => throw new ArgumentOutOfRangeException(nameof(t), t, null)
    };

    internal static string ToValidityString(Validity v) => v switch
    {
        Validity.Day => "DAY",
        Validity.IOC => "IOC",
        _ => throw new ArgumentOutOfRangeException(nameof(v), v, null)
    };

    internal PlaceOrderRequest BuildOrderRequest(
        string instrumentToken, int quantity, TransactionType transactionType,
        OrderType orderType, Product product, Validity validity,
        decimal price, decimal triggerPrice, bool isAmo, string? tag, bool slice)
        => new()
        {
            InstrumentToken = instrumentToken,
            Quantity = quantity,
            TransactionType = transactionType,
            OrderType = orderType,
            Product = product,
            Validity = validity,
            Price = price,
            TriggerPrice = triggerPrice,
            IsAmo = isAmo,
            Tag = tag,
            Slice = slice
        };

    // ── Internal DTOs ───────────────────────────────────────────────────────

    private sealed class PlaceOrderDtoV3
    {
        [JsonPropertyName("quantity")] public int Quantity { get; init; }
        [JsonPropertyName("product")] public string Product { get; init; } = "";
        [JsonPropertyName("validity")] public string Validity { get; init; } = "";
        [JsonPropertyName("price")] public decimal Price { get; init; }
        [JsonPropertyName("tag")] public string? Tag { get; init; }
        [JsonPropertyName("instrument_token")] public string InstrumentToken { get; init; } = "";
        [JsonPropertyName("order_type")] public string OrderType { get; init; } = "";
        [JsonPropertyName("transaction_type")] public string TransactionType { get; init; } = "";
        [JsonPropertyName("disclosed_quantity")] public int DisclosedQuantity { get; init; }
        [JsonPropertyName("trigger_price")] public decimal TriggerPrice { get; init; }
        [JsonPropertyName("is_amo")] public bool IsAmo { get; init; }
        [JsonPropertyName("slice")] public bool Slice { get; init; }
    }

    private sealed class PlaceOrderRawV3
    {
        [JsonPropertyName("order_ids")] public List<string>? OrderIds { get; init; }
    }

    private sealed class OrderIdRaw
    {
        [JsonPropertyName("order_id")] public string? OrderId { get; init; }
    }
}
