using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Zerodha.Http;

/// <summary>
/// Internal HTTP layer wrapping the Kite Connect REST API v3.
/// Uses two named HttpClients:
/// <list type="bullet">
///   <item><c>"ZerodhaApi"</c> — authenticated calls (positions, orders, funds).</item>
///   <item><c>"ZerodhaAuth"</c> — session/token exchange only; no auth header.</item>
/// </list>
/// </summary>
public sealed class ZerodhaHttpClient
{
    private readonly IHttpClientFactory _httpFactory;
    private static readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    public ZerodhaHttpClient(IHttpClientFactory httpFactory) => _httpFactory = httpFactory;

    // ── Positions ─────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<Position>> GetPositionsAsync(CancellationToken ct = default)
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

    // ── Funds ────────────────────────────────────────────────────────────────

    public async Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
    {
        var http = _httpFactory.CreateClient("ZerodhaApi");
        var root = await http.GetFromJsonAsync<KiteEnvelope<KiteMarginsData>>("/user/margins", _json, ct)
            ?? throw new InvalidOperationException("Null response from Kite /user/margins");

        EnsureSuccess(root);

        var equity = root.Data?.Equity;
        var available = equity?.Available?.LiveBalance ?? 0;
        var used = (equity?.Utilised?.M2mUnrealised ?? 0)
                 + (equity?.Utilised?.Debits ?? 0)
                 + (equity?.Utilised?.Exposure ?? 0)
                 + (equity?.Utilised?.OptionPremium ?? 0);

        return new BrokerFunds(available, used);
    }

    // ── Margin ────────────────────────────────────────────────────────────────

    public async Task<ZerodhaMarginResponse> GetRequiredMarginAsync(
        IEnumerable<ZerodhaMarginOrderItem> items, CancellationToken ct = default)
    {
        var body = items.Select(i => new KiteMarginOrderDto
        {
            TradingSymbol   = i.TradingSymbol,
            Exchange        = i.Exchange,
            TransactionType = i.TransactionType.ToUpperInvariant(),
            Variety         = "regular",
            Product         = i.Product.ToUpperInvariant(),
            OrderType       = "MARKET",
            Quantity        = i.Quantity,
        }).ToList();

        var http = _httpFactory.CreateClient("ZerodhaApi");
        var response = await http.PostAsJsonAsync(
            "/margins/basket?consider_positions=true&mode=compact", body, _json, ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<KiteEnvelope<KiteBasketMarginData>>(_json, ct)
            ?? throw new InvalidOperationException("Null response from Kite basket margin");
        EnsureSuccess(result);

        return new ZerodhaMarginResponse(
            RequiredMargin: result.Data?.Initial?.Total ?? 0m,
            FinalMargin:    result.Data?.Final?.Total   ?? 0m);
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    public async Task<string> PlaceOrderAsync(
        string tradingSymbol,
        string exchange,
        string transactionType,
        string product,
        string orderType,
        int quantity,
        decimal? price,
        CancellationToken ct = default)
    {
        var http = _httpFactory.CreateClient("ZerodhaApi");

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

        var response = await http.PostAsync("/orders/regular", new FormUrlEncodedContent(form), ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<KiteEnvelope<KiteOrderData>>(_json, ct)
            ?? throw new InvalidOperationException("Null response placing Zerodha order");

        EnsureSuccess(result);
        return result.Data?.OrderId ?? "";
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    public async Task<string> ExchangeTokenAsync(
        string apiKey, string apiSecret, string requestToken, CancellationToken ct = default)
    {
        var checksum = ComputeChecksum(apiKey, requestToken, apiSecret);

        var http = _httpFactory.CreateClient("ZerodhaAuth");
        var form = new Dictionary<string, string>
        {
            ["api_key"]       = apiKey,
            ["request_token"] = requestToken,
            ["checksum"]      = checksum,
        };

        var response = await http.PostAsync("/session/token", new FormUrlEncodedContent(form), ct);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<KiteEnvelope<KiteSessionData>>(_json, ct)
            ?? throw new InvalidOperationException("Null response exchanging Zerodha token");

        EnsureSuccess(result);
        return result.Data?.AccessToken
            ?? throw new InvalidOperationException("No access_token in Zerodha session response");
    }

    public string GetLoginUrl(string apiKey)
        => $"https://kite.zerodha.com/connect/login?api_key={apiKey}&v=3";

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void EnsureSuccess<T>(KiteEnvelope<T> envelope)
    {
        if (!envelope.Status.Equals("success", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"Kite API error: {envelope.ErrorType} — {envelope.Message}");
    }

    private static string ComputeChecksum(string apiKey, string requestToken, string apiSecret)
    {
        var raw = Encoding.UTF8.GetBytes(apiKey + requestToken + apiSecret);
        var hash = SHA256.HashData(raw);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static Position MapPosition(KiteNetPosition p) => new()
    {
        Exchange        = p.Exchange ?? "",
        InstrumentToken = p.TradingSymbol ?? "",
        TradingSymbol   = p.TradingSymbol ?? "",
        Product         = MapProduct(p.Product),
        Quantity        = p.Quantity,
        AveragePrice    = p.AveragePrice,
        Ltp             = p.LastPrice,
        Pnl             = p.Pnl,
        Unrealised      = p.Unrealised,
        Realised        = p.Realised,
        BuyPrice        = p.BuyPrice,
        SellPrice       = p.SellPrice,
        BuyQuantity     = p.DayBuyQuantity,
        SellQuantity    = p.DaySellQuantity,
        Broker          = "zerodha",
    };

    /// <summary>Normalise Zerodha product codes to unified broker codes.</summary>
    private static string MapProduct(string? zerodhaProduct) => zerodhaProduct?.ToUpperInvariant() switch
    {
        "MIS"  => "I",
        "CNC"  => "D",
        "NRML" => "NRML",
        _      => zerodhaProduct ?? "",
    };

    // ── Private DTOs (Kite Connect response shapes) ────────────────────────────

    private sealed class KiteEnvelope<T>
    {
        [JsonPropertyName("status")]     public string  Status    { get; init; } = "";
        [JsonPropertyName("data")]       public T?      Data      { get; init; }
        [JsonPropertyName("error_type")] public string? ErrorType { get; init; }
        [JsonPropertyName("message")]    public string? Message   { get; init; }
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

    private sealed class KiteMarginsData
    {
        [JsonPropertyName("equity")]    public KiteSegmentMargins? Equity    { get; init; }
        [JsonPropertyName("commodity")] public KiteSegmentMargins? Commodity { get; init; }
    }

    private sealed class KiteSegmentMargins
    {
        [JsonPropertyName("available")] public KiteAvailableMargins? Available { get; init; }
        [JsonPropertyName("utilised")]  public KiteUtilisedMargins?  Utilised  { get; init; }
        [JsonPropertyName("net")]       public decimal                Net       { get; init; }
    }

    private sealed class KiteAvailableMargins
    {
        [JsonPropertyName("live_balance")] public decimal LiveBalance { get; init; }
        [JsonPropertyName("cash")]         public decimal Cash        { get; init; }
        [JsonPropertyName("collateral")]   public decimal Collateral  { get; init; }
    }

    private sealed class KiteUtilisedMargins
    {
        [JsonPropertyName("m2m_unrealised")] public decimal M2mUnrealised { get; init; }
        [JsonPropertyName("debits")]         public decimal Debits        { get; init; }
        [JsonPropertyName("exposure")]       public decimal Exposure      { get; init; }
        [JsonPropertyName("option_premium")] public decimal OptionPremium { get; init; }
    }

    private sealed class KiteOrderData
    {
        [JsonPropertyName("order_id")] public string? OrderId { get; init; }
    }

    private sealed class KiteSessionData
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; init; }
        [JsonPropertyName("api_key")]      public string? ApiKey      { get; init; }
        [JsonPropertyName("user_name")]    public string? UserName    { get; init; }
        [JsonPropertyName("email")]        public string? Email       { get; init; }
    }

    private sealed class KiteMarginOrderDto
    {
        [JsonPropertyName("tradingsymbol")]   public string TradingSymbol   { get; init; } = "";
        [JsonPropertyName("exchange")]        public string Exchange        { get; init; } = "";
        [JsonPropertyName("transaction_type")]public string TransactionType { get; init; } = "";
        [JsonPropertyName("variety")]         public string Variety         { get; init; } = "regular";
        [JsonPropertyName("product")]         public string Product         { get; init; } = "";
        [JsonPropertyName("order_type")]      public string OrderType       { get; init; } = "MARKET";
        [JsonPropertyName("quantity")]        public int    Quantity        { get; init; }
    }

    private sealed class KiteBasketMarginData
    {
        [JsonPropertyName("initial")] public KiteMarginTotals? Initial { get; init; }
        [JsonPropertyName("final")]   public KiteMarginTotals? Final   { get; init; }
    }

    private sealed class KiteMarginTotals
    {
        [JsonPropertyName("total")]    public decimal Total    { get; init; }
        [JsonPropertyName("span")]     public decimal Span     { get; init; }
        [JsonPropertyName("exposure")] public decimal Exposure { get; init; }
    }
}
