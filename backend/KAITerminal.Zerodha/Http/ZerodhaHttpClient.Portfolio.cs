using System.Net.Http.Json;
using System.Text.Json.Serialization;
using KAITerminal.Contracts.Domain;

namespace KAITerminal.Zerodha.Http;

public sealed partial class ZerodhaHttpClient
{
    public async Task<IReadOnlyList<BrokerPosition>> GetPositionsAsync(CancellationToken ct = default)
    {
        var http = _httpFactory.CreateClient("ZerodhaApi");
        var root = await http.GetFromJsonAsync<KiteEnvelope<KitePositionData>>("/portfolio/positions", _json, ct)
            ?? throw new InvalidOperationException("Null response from Kite /portfolio/positions");

        EnsureSuccess(root);

        return (root.Data?.Net ?? [])
            .Select(MapPosition)
            .ToList()
            .AsReadOnly();
    }

    public async Task ConvertPositionAsync(
        string tradingSymbol,
        string exchange,
        string transactionType,
        string positionType,
        string oldProduct,
        string newProduct,
        int quantity,
        CancellationToken ct = default)
    {
        var form = new Dictionary<string, string>
        {
            ["exchange"]         = exchange,
            ["tradingsymbol"]    = tradingSymbol,
            ["transaction_type"] = transactionType.ToUpperInvariant(),
            ["position_type"]    = positionType,   // "day" (MIS) or "overnight" (NRML/CNC)
            ["quantity"]         = quantity.ToString(),
            ["old_product"]      = oldProduct.ToUpperInvariant(),
            ["new_product"]      = newProduct.ToUpperInvariant(),
        };

        var http     = _httpFactory.CreateClient("ZerodhaApi");
        var response = await http.PutAsync("/portfolio/positions", new FormUrlEncodedContent(form), ct);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException(
                $"Kite position convert failed ({(int)response.StatusCode}): {body}",
                null, response.StatusCode);
        }

        var result = await response.Content.ReadFromJsonAsync<KiteEnvelope<bool>>(_json, ct)
            ?? throw new InvalidOperationException("Null response converting Zerodha position");
        EnsureSuccess(result);
    }

    private sealed class KitePositionData
    {
        [JsonPropertyName("net")] public List<KiteNetPosition> Net { get; init; } = [];
        [JsonPropertyName("day")] public List<KiteNetPosition> Day { get; init; } = [];
    }

    private sealed class KiteNetPosition
    {
        [JsonPropertyName("tradingsymbol")]     public string?  TradingSymbol   { get; init; }
        [JsonPropertyName("exchange")]          public string?  Exchange        { get; init; }
        [JsonPropertyName("instrument_token")]  public long     InstrumentToken { get; init; }
        [JsonPropertyName("product")]           public string?  Product         { get; init; }
        [JsonPropertyName("quantity")]          public int      Quantity        { get; init; }
        [JsonPropertyName("multiplier")]        public decimal  Multiplier      { get; init; } = 1;
        [JsonPropertyName("average_price")]     public decimal  AveragePrice    { get; init; }
        [JsonPropertyName("last_price")]        public decimal  LastPrice       { get; init; }
        [JsonPropertyName("pnl")]               public decimal  Pnl             { get; init; }
        [JsonPropertyName("unrealised")]        public decimal  Unrealised      { get; init; }
        [JsonPropertyName("realised")]          public decimal  Realised        { get; init; }
        [JsonPropertyName("buy_price")]         public decimal  BuyPrice        { get; init; }
        [JsonPropertyName("sell_price")]        public decimal  SellPrice       { get; init; }
        [JsonPropertyName("day_buy_quantity")]  public int      DayBuyQuantity  { get; init; }
        [JsonPropertyName("day_sell_quantity")] public int      DaySellQuantity { get; init; }
    }
}
