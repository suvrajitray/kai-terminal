using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace KAITerminal.Zerodha.Http;

public sealed partial class ZerodhaHttpClient
{
    internal async Task<IReadOnlyList<KiteOrder>> GetOrdersAsync(CancellationToken ct = default)
    {
        var http     = _httpFactory.CreateClient("ZerodhaApi");
        var response = await http.GetAsync("/orders", ct);
        if (!response.IsSuccessStatusCode) return [];
        var result = await response.Content.ReadFromJsonAsync<KiteEnvelope<List<KiteOrder>>>(_json, ct);
        return result?.Data ?? [];
    }

    public async Task<string> PlaceOrderAsync(
        string tradingSymbol,
        string exchange,
        string transactionType,
        string product,
        string orderType,
        int quantity,
        decimal? price,
        decimal? triggerPrice = null,
        CancellationToken ct = default)
    {
        var http = _httpFactory.CreateClient("ZerodhaApi");
        var form = BuildPlaceOrderForm(tradingSymbol, exchange, transactionType, product, orderType, quantity, price, triggerPrice);

        var response = await http.PostAsync("/orders/regular", new FormUrlEncodedContent(form), ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"Zerodha order failed ({(int)response.StatusCode}): {body}");
        }

        var result = await response.Content.ReadFromJsonAsync<KiteEnvelope<KiteOrderData>>(_json, ct)
            ?? throw new InvalidOperationException("Null response placing Zerodha order");

        EnsureSuccess(result);
        return result.Data?.OrderId ?? "";
    }

    public async Task<string> CancelOrderAsync(string orderId, CancellationToken ct = default)
    {
        var http = _httpFactory.CreateClient("ZerodhaApi");
        var response = await http.DeleteAsync($"/orders/regular/{Uri.EscapeDataString(orderId)}", ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"Zerodha cancel order failed ({(int)response.StatusCode}): {body}");
        }

        var result = await response.Content.ReadFromJsonAsync<KiteEnvelope<KiteOrderData>>(_json, ct)
            ?? throw new InvalidOperationException("Null response cancelling Zerodha order");

        EnsureSuccess(result);
        return result.Data?.OrderId ?? orderId;
    }

    private static Dictionary<string, string> BuildPlaceOrderForm(
        string tradingSymbol, string exchange, string transactionType, string product,
        string orderType, int quantity, decimal? price, decimal? triggerPrice)
    {
        var form = new Dictionary<string, string>
        {
            ["tradingsymbol"]    = tradingSymbol,
            ["exchange"]         = exchange,
            ["transaction_type"] = transactionType.ToUpperInvariant(),
            ["product"]          = product.ToUpperInvariant(),
            ["order_type"]       = orderType.ToUpperInvariant(),
            ["quantity"]         = quantity.ToString(),
        };

        if (orderType.Equals("LIMIT", StringComparison.OrdinalIgnoreCase) && price.HasValue)
            form["price"] = price.Value.ToString("F2");

        if (orderType.Equals("MARKET", StringComparison.OrdinalIgnoreCase))
            form["market_protection"] = "1";

        if ((orderType.Equals("SL", StringComparison.OrdinalIgnoreCase) ||
             orderType.Equals("SL-M", StringComparison.OrdinalIgnoreCase)) && triggerPrice.HasValue)
            form["trigger_price"] = triggerPrice.Value.ToString("F2");

        if (orderType.Equals("SL", StringComparison.OrdinalIgnoreCase) && price.HasValue)
            form["price"] = price.Value.ToString("F2");

        return form;
    }

    internal sealed class KiteOrder
    {
        [JsonPropertyName("order_id")]          public string?  OrderId          { get; init; }
        [JsonPropertyName("exchange_order_id")] public string?  ExchangeOrderId  { get; init; }
        [JsonPropertyName("exchange")]          public string?  Exchange         { get; init; }
        [JsonPropertyName("tradingsymbol")]     public string?  TradingSymbol    { get; init; }
        [JsonPropertyName("product")]           public string?  Product          { get; init; }
        [JsonPropertyName("order_type")]        public string?  OrderType        { get; init; }
        [JsonPropertyName("transaction_type")]  public string?  TransactionType  { get; init; }
        [JsonPropertyName("validity")]          public string?  Validity         { get; init; }
        [JsonPropertyName("status")]            public string?  Status           { get; init; }
        [JsonPropertyName("status_message")]    public string?  StatusMessage    { get; init; }
        [JsonPropertyName("price")]             public decimal  Price            { get; init; }
        [JsonPropertyName("average_price")]     public decimal  AveragePrice     { get; init; }
        [JsonPropertyName("quantity")]          public int      Quantity         { get; init; }
        [JsonPropertyName("filled_quantity")]   public int      FilledQuantity   { get; init; }
        [JsonPropertyName("pending_quantity")]  public int      PendingQuantity  { get; init; }
        [JsonPropertyName("tag")]               public string?  Tag              { get; init; }
        [JsonPropertyName("order_timestamp")]   public string?  OrderTimestamp   { get; init; }
    }
}
