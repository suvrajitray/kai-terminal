using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using KAITerminal.Upstox.Exceptions;
using KAITerminal.Upstox.Models;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Upstox.Models.WebSocket;

namespace KAITerminal.Upstox.Http;

/// <summary>
/// Internal HTTP client that wraps the Upstox REST API.
/// Uses two named HttpClients: "UpstoxApi" (read) and "UpstoxHft" (order writes).
/// </summary>
internal sealed class UpstoxHttpClient
{
    private readonly IHttpClientFactory _factory;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    public UpstoxHttpClient(IHttpClientFactory factory)
    {
        _factory = factory;
    }

    // ──────────────────────────────────────────────────
    // Portfolio
    // ──────────────────────────────────────────────────

    public Task<IReadOnlyList<Position>> GetPositionsAsync(CancellationToken ct = default)
        => GetListAsync<Position>("UpstoxApi", "/v2/portfolio/short-term-positions", ct);

    // ──────────────────────────────────────────────────
    // Orders
    // ──────────────────────────────────────────────────

    public Task<IReadOnlyList<Order>> GetAllOrdersAsync(CancellationToken ct = default)
        => GetListAsync<Order>("UpstoxApi", "/v2/order/retrieve-all", ct);

    public async Task<PlaceOrderV3Result> PlaceOrderV3Async(PlaceOrderRequest req, CancellationToken ct = default)
    {
        var dto = new PlaceOrderDtoV3
        {
            Quantity = req.Quantity,
            Product = ToProductString(req.Product),
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

    // ──────────────────────────────────────────────────
    // WebSocket feed authorization (returns wss:// URI)
    // ──────────────────────────────────────────────────

    public async Task<string> GetMarketDataFeedUriV3Async(CancellationToken ct = default)
    {
        var client = _factory.CreateClient("UpstoxApi");
        var response = await client.GetAsync("/v3/feed/market-data-feed/authorize", ct);
        var data = await HandleResponseAsync<AuthorizeResponse>(response, ct);
        return data.AuthorizedRedirectUri
            ?? throw new UpstoxException("Missing authorizedRedirectUri in market data feed authorize response");
    }

    public async Task<string> GetPortfolioStreamFeedUriAsync(
        IEnumerable<UpdateType>? updateTypes, CancellationToken ct = default)
    {
        var path = "/v2/feed/portfolio-stream-feed/authorize";

        if (updateTypes is not null)
        {
            var parts = updateTypes.Select(t => $"update_types={ToUpdateTypeString(t)}").ToList();
            if (parts.Count > 0)
                path += "?" + string.Join("&", parts);
        }

        var client = _factory.CreateClient("UpstoxApi");
        var response = await client.GetAsync(path, ct);
        var data = await HandleResponseAsync<AuthorizeResponse>(response, ct);
        return data.AuthorizedRedirectUri
            ?? throw new UpstoxException("Missing authorizedRedirectUri in portfolio stream feed authorize response");
    }

    // ──────────────────────────────────────────────────
    // Auth — token generation (no Bearer; raw JSON response)
    // ──────────────────────────────────────────────────

    public async Task<TokenResponse> GenerateTokenAsync(
        string clientId, string clientSecret, string redirectUri, string authorizationCode,
        CancellationToken ct = default)
    {
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"]          = authorizationCode,
            ["client_id"]     = clientId,
            ["client_secret"] = clientSecret,
            ["redirect_uri"]  = redirectUri,
            ["grant_type"]    = "authorization_code"
        });

        var client = _factory.CreateClient("UpstoxAuth");
        var response = await client.PostAsync("/v2/login/authorization/token", form, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new UpstoxException(
                $"Token generation failed: {json}",
                (int)response.StatusCode);

        return JsonSerializer.Deserialize<TokenResponse>(json, JsonOptions)
            ?? throw new UpstoxException("Empty or invalid token response from Upstox");
    }

    // ──────────────────────────────────────────────────
    // Market quotes
    // ──────────────────────────────────────────────────

    public async Task<IReadOnlyDictionary<string, MarketQuote>> GetMarketQuotesAsync(
        IEnumerable<string> instrumentKeys, CancellationToken ct = default)
    {
        var keys = string.Join(",", instrumentKeys.Select(Uri.EscapeDataString));
        var dict = await GetObjectAsync<Dictionary<string, MarketQuote>>(
            "UpstoxApi", $"/v2/market-quote/quotes?instrument_key={keys}", ct);
        return dict;
    }

    // ──────────────────────────────────────────────────
    // Historical / intraday candles
    // ──────────────────────────────────────────────────

    public async Task<IReadOnlyList<CandleData>> GetHistoricalCandlesAsync(
        string instrumentKey, string interval, DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        var ek   = Uri.EscapeDataString(instrumentKey);
        var path = $"/v2/historical-candle/{ek}/{interval}/{to:yyyy-MM-dd}/{from:yyyy-MM-dd}";
        return await FetchCandlesAsync(path, ct);
    }

    public async Task<IReadOnlyList<CandleData>> GetIntradayCandlesAsync(
        string instrumentKey, string interval, CancellationToken ct = default)
    {
        var ek   = Uri.EscapeDataString(instrumentKey);
        var path = $"/v2/historical-candle/intraday/{ek}/{interval}";
        return await FetchCandlesAsync(path, ct);
    }

    private async Task<IReadOnlyList<CandleData>> FetchCandlesAsync(string path, CancellationToken ct)
    {
        var client   = _factory.CreateClient("UpstoxApi");
        var response = await client.GetAsync(path, ct);
        var json     = await response.Content.ReadAsStringAsync(ct);

        var wrapper = JsonSerializer.Deserialize<CandlesWrapper>(json, JsonOptions);
        if (wrapper?.Status != "success" || wrapper.Data?.Candles is null)
            return Array.Empty<CandleData>();

        return wrapper.Data.Candles
            .Where(r => r.Count >= 6)
            .Select(MapCandle)
            .OrderBy(c => c.Timestamp)
            .ToList()
            .AsReadOnly();
    }

    private static CandleData MapCandle(List<JsonElement> row) => new()
    {
        Timestamp = row[0].GetDateTime(),
        Open      = row[1].GetDecimal(),
        High      = row[2].GetDecimal(),
        Low       = row[3].GetDecimal(),
        Close     = row[4].GetDecimal(),
        Volume    = row[5].GetInt64(),
        Oi        = row.Count > 6 ? row[6].GetInt64() : 0
    };

    // ──────────────────────────────────────────────────
    // Option chain
    // ──────────────────────────────────────────────────

    public Task<IReadOnlyList<OptionChainEntry>> GetOptionChainAsync(
        string underlyingKey, string expiryDate, CancellationToken ct = default)
    {
        var ek = Uri.EscapeDataString(underlyingKey);
        var path = $"/v2/option/chain?instrument_key={ek}&expiry_date={Uri.EscapeDataString(expiryDate)}";
        return GetListAsync<OptionChainEntry>("UpstoxApi", path, ct);
    }

    public Task<IReadOnlyList<OptionContract>> GetOptionContractsAsync(
        string underlyingKey, string? expiryDate = null, CancellationToken ct = default)
    {
        var ek = Uri.EscapeDataString(underlyingKey);
        var path = $"/v2/option/contract?instrument_key={ek}";
        if (!string.IsNullOrEmpty(expiryDate))
            path += $"&expiry_date={Uri.EscapeDataString(expiryDate)}";
        return GetListAsync<OptionContract>("UpstoxApi", path, ct);
    }

    // ──────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────

    private async Task<IReadOnlyList<T>> GetListAsync<T>(
        string clientName, string path, CancellationToken ct)
    {
        var client = _factory.CreateClient(clientName);
        var response = await client.GetAsync(path, ct);
        var data = await HandleResponseAsync<List<T>>(response, ct);
        return data.AsReadOnly();
    }

    private async Task<T> GetObjectAsync<T>(string clientName, string path, CancellationToken ct)
    {
        var client = _factory.CreateClient(clientName);
        var response = await client.GetAsync(path, ct);
        return await HandleResponseAsync<T>(response, ct);
    }

    private async Task<T> PostAsync<T>(
        string clientName, string path, object body, CancellationToken ct)
    {
        var client = _factory.CreateClient(clientName);
        var response = await client.PostAsJsonAsync(path, body, JsonOptions, ct);
        return await HandleResponseAsync<T>(response, ct);
    }

    private async Task<(T Data, int Latency)> PostWithMetaAsync<T>(
        string clientName, string path, object body, CancellationToken ct)
    {
        var client = _factory.CreateClient(clientName);
        var response = await client.PostAsJsonAsync(path, body, JsonOptions, ct);
        return await HandleResponseWithMetaAsync<T>(response, ct);
    }

    private async Task<T> HandleResponseAsync<T>(HttpResponseMessage response, CancellationToken ct)
    {
        var (data, _) = await HandleResponseWithMetaAsync<T>(response, ct);
        return data;
    }

    private async Task<(T Data, int Latency)> HandleResponseWithMetaAsync<T>(
        HttpResponseMessage response, CancellationToken ct)
    {
        var json = await response.Content.ReadAsStringAsync(ct);

        UpstoxEnvelope<T>? envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<UpstoxEnvelope<T>>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new UpstoxException(
                $"Failed to deserialize Upstox response: {ex.Message}",
                (int)response.StatusCode);
        }

        if (envelope?.Status != "success" || envelope.Data is null)
        {
            var errors = envelope?.Errors?
                .Select(e => new UpstoxApiError { ErrorCode = e.ErrorCode, Message = e.Message })
                .ToList()
                .AsReadOnly();

            var msg = errors?.FirstOrDefault()?.Message
                      ?? $"Upstox API error (HTTP {(int)response.StatusCode})";
            var code = errors?.FirstOrDefault()?.ErrorCode;

            throw new UpstoxException(msg, (int)response.StatusCode, code, errors);
        }

        var latency = envelope.Metadata?.Latency ?? 0;
        return (envelope.Data, latency);
    }

    // ──────────────────────────────────────────────────
    // Enum → API string conversions
    // ──────────────────────────────────────────────────

    internal static string ToOrderTypeString(OrderType t) => t switch
    {
        OrderType.Market => "MARKET",
        OrderType.Limit => "LIMIT",
        OrderType.SL => "SL",
        OrderType.SLM => "SL-M",
        _ => throw new ArgumentOutOfRangeException(nameof(t), t, null)
    };

    internal static string ToTransactionTypeString(TransactionType t) => t switch
    {
        TransactionType.Buy => "BUY",
        TransactionType.Sell => "SELL",
        _ => throw new ArgumentOutOfRangeException(nameof(t), t, null)
    };

    internal static string ToProductString(Product p) => p switch
    {
        Product.Intraday => "I",
        Product.Delivery => "D",
        Product.MTF => "MTF",
        Product.CoverOrder => "CO",
        _ => throw new ArgumentOutOfRangeException(nameof(p), p, null)
    };

    internal static string ToValidityString(Validity v) => v switch
    {
        Validity.Day => "DAY",
        Validity.IOC => "IOC",
        _ => throw new ArgumentOutOfRangeException(nameof(v), v, null)
    };

    internal static string ToUpdateTypeString(UpdateType t) => t switch
    {
        UpdateType.Order    => "order",
        UpdateType.Position => "position",
        UpdateType.Holding  => "holding",
        UpdateType.GttOrder => "gtt_order",
        _ => throw new ArgumentOutOfRangeException(nameof(t), t, null)
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

    // ──────────────────────────────────────────────────
    // Internal DTOs (serialisation only)
    // ──────────────────────────────────────────────────

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

    private sealed class UpstoxEnvelope<T>
    {
        [JsonPropertyName("status")] public string? Status { get; init; }
        [JsonPropertyName("data")] public T? Data { get; init; }
        [JsonPropertyName("errors")] public List<ApiErrorDto>? Errors { get; init; }
        [JsonPropertyName("metadata")] public MetadataDto? Metadata { get; init; }
    }

    private sealed class ApiErrorDto
    {
        [JsonPropertyName("errorCode")] public string? ErrorCode { get; init; }
        [JsonPropertyName("message")] public string? Message { get; init; }
    }

    private sealed class MetadataDto
    {
        [JsonPropertyName("latency")] public int Latency { get; init; }
    }

    private sealed class AuthorizeResponse
    {
        [JsonPropertyName("authorizedRedirectUri")] public string? AuthorizedRedirectUri { get; init; }
    }

    // Candle jagged-array response: { "status": "success", "data": { "candles": [[ts,o,h,l,c,v,oi], ...] } }
    private sealed class CandlesWrapper
    {
        [JsonPropertyName("status")] public string?           Status { get; init; }
        [JsonPropertyName("data")]   public CandlesDataDto?   Data   { get; init; }
    }

    private sealed class CandlesDataDto
    {
        [JsonPropertyName("candles")] public List<List<JsonElement>>? Candles { get; init; }
    }
}
