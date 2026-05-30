using System.Net.Http.Json;
using System.Text.Json.Serialization;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Zerodha.Http;

public sealed partial class ZerodhaHttpClient
{
    public async Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
    {
        var http = _httpFactory.CreateClient("ZerodhaApi");
        var root = await http.GetFromJsonAsync<KiteEnvelope<KiteMarginsData>>("/user/margins", _json, ct)
            ?? throw new InvalidOperationException("Null response from Kite /user/margins");

        EnsureSuccess(root);

        var equity = root.Data?.Equity;
        var available = equity?.Net ?? 0;
        var used = (equity?.Utilised?.M2mUnrealised ?? 0)
                 + (equity?.Utilised?.Debits ?? 0)
                 + (equity?.Utilised?.Exposure ?? 0)
                 + (equity?.Utilised?.OptionPremium ?? 0);

        return new BrokerFunds(available, used);
    }

    internal async Task<ZerodhaMarginResponse> GetRequiredMarginAsync(
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
