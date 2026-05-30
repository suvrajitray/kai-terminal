using System.Text.Json;
using System.Text.Json.Serialization;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;

namespace KAITerminal.Zerodha.Http;

/// <summary>
/// Internal HTTP layer wrapping the Kite Connect REST API v3.
/// Uses two named HttpClients:
/// <list type="bullet">
///   <item><c>"ZerodhaApi"</c> — authenticated calls (positions, orders, funds).</item>
///   <item><c>"ZerodhaAuth"</c> — session/token exchange only; no auth header.</item>
/// </list>
///
/// Partial-class split by domain — see <c>ZerodhaHttpClient.Orders.cs</c>,
/// <c>ZerodhaHttpClient.Portfolio.cs</c>, <c>ZerodhaHttpClient.Funds.cs</c>,
/// <c>ZerodhaHttpClient.Auth.cs</c>.
/// </summary>
public sealed partial class ZerodhaHttpClient
{
    private readonly IHttpClientFactory _httpFactory;
    private static readonly JsonSerializerOptions _json = new() { PropertyNameCaseInsensitive = true };

    public ZerodhaHttpClient(IHttpClientFactory httpFactory) => _httpFactory = httpFactory;

    private static void EnsureSuccess<T>(KiteEnvelope<T> envelope)
    {
        if (!envelope.Status.Equals("success", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException(
                $"Kite API error: {envelope.ErrorType} — {envelope.Message}");
    }

    private static BrokerPosition MapPosition(KiteNetPosition p) => new()
    {
        Exchange        = p.Exchange ?? "",
        InstrumentToken = p.TradingSymbol ?? "",
        TradingSymbol   = p.TradingSymbol ?? "",
        Product         = ZerodhaProductMap.ToUnified(p.Product),
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
        Broker          = BrokerNames.Zerodha,
    };

    private sealed class KiteEnvelope<T>
    {
        [JsonPropertyName("status")]     public string  Status    { get; init; } = "";
        [JsonPropertyName("data")]       public T?      Data      { get; init; }
        [JsonPropertyName("error_type")] public string? ErrorType { get; init; }
        [JsonPropertyName("message")]    public string? Message   { get; init; }
    }

    private sealed class KiteOrderData
    {
        [JsonPropertyName("order_id")] public string? OrderId { get; init; }
    }
}
