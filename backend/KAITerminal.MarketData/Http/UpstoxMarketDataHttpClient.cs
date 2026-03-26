using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using KAITerminal.Contracts.Options;
using KAITerminal.MarketData.Models;

namespace KAITerminal.MarketData.Http;

/// <summary>
/// Internal HTTP client for Upstox market data APIs.
/// Each method receives an explicit bearer token — no ambient token context.
/// This makes it safe to use with the analytics token from AppSettings.
/// </summary>
internal sealed class UpstoxMarketDataHttpClient
{
    private readonly IHttpClientFactory _factory;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        NumberHandling = JsonNumberHandling.AllowReadingFromString
    };

    public UpstoxMarketDataHttpClient(IHttpClientFactory factory) => _factory = factory;

    // ──────────────────────────────────────────────────
    // WebSocket feed authorization
    // ──────────────────────────────────────────────────

    public async Task<string> GetMarketDataFeedUriAsync(string token, CancellationToken ct = default)
    {
        var client = CreateClient(token);
        var response = await client.GetAsync("/v3/feed/market-data-feed/authorize", ct);
        var data = await HandleResponseAsync<AuthorizeResponse>(response, ct);
        return data.AuthorizedRedirectUri
            ?? throw new InvalidOperationException("Missing authorizedRedirectUri in market data feed authorize response");
    }

    // ──────────────────────────────────────────────────
    // Market quotes
    // ──────────────────────────────────────────────────

    public async Task<IReadOnlyDictionary<string, MarketQuote>> GetMarketQuotesAsync(
        string token, IEnumerable<string> instrumentKeys, CancellationToken ct = default)
    {
        var keys = string.Join(",", instrumentKeys.Select(Uri.EscapeDataString));
        var client = CreateClient(token);
        var response = await client.GetAsync($"/v2/market-quote/quotes?instrument_key={keys}", ct);
        return await HandleResponseAsync<Dictionary<string, MarketQuote>>(response, ct);
    }

    // ──────────────────────────────────────────────────
    // Historical / intraday candles
    // ──────────────────────────────────────────────────

    public async Task<IReadOnlyList<CandleData>> GetHistoricalCandlesAsync(
        string token, string instrumentKey, string interval,
        DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        var ek   = Uri.EscapeDataString(instrumentKey);
        var path = $"/v2/historical-candle/{ek}/{interval}/{to:yyyy-MM-dd}/{from:yyyy-MM-dd}";
        return await FetchCandlesAsync(token, path, ct);
    }

    public async Task<IReadOnlyList<CandleData>> GetIntradayCandlesAsync(
        string token, string instrumentKey, string interval, CancellationToken ct = default)
    {
        var ek   = Uri.EscapeDataString(instrumentKey);
        var path = $"/v2/historical-candle/intraday/{ek}/{interval}";
        return await FetchCandlesAsync(token, path, ct);
    }

    private async Task<IReadOnlyList<CandleData>> FetchCandlesAsync(
        string token, string path, CancellationToken ct)
    {
        var client   = CreateClient(token);
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

    public async Task<IReadOnlyList<OptionChainEntry>> GetOptionChainAsync(
        string token, string underlyingKey, string expiryDate, CancellationToken ct = default)
    {
        var ek     = Uri.EscapeDataString(underlyingKey);
        var path   = $"/v2/option/chain?instrument_key={ek}&expiry_date={Uri.EscapeDataString(expiryDate)}";
        var client = CreateClient(token);
        var response = await client.GetAsync(path, ct);
        var raw = await HandleResponseAsync<List<RawOptionChainEntry>>(response, ct);
        return raw.Select(MapChainEntry).ToList().AsReadOnly();
    }

    // ──────────────────────────────────────────────────
    // Option contracts (metadata, no live prices)
    // ──────────────────────────────────────────────────

    public async Task<IReadOnlyList<RawOptionContract>> GetOptionContractsAsync(
        string token, string underlyingKey, string? expiryDate = null, CancellationToken ct = default)
    {
        var ek   = Uri.EscapeDataString(underlyingKey);
        var path = $"/v2/option/contract?instrument_key={ek}";
        if (!string.IsNullOrEmpty(expiryDate))
            path += $"&expiry_date={Uri.EscapeDataString(expiryDate)}";
        var client = CreateClient(token);
        var response = await client.GetAsync(path, ct);
        return await HandleResponseAsync<List<RawOptionContract>>(response, ct);
    }

    // ──────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────

    private HttpClient CreateClient(string token)
    {
        var client = _factory.CreateClient("UpstoxMarketData");
        // Clone with token header — don't mutate the shared client
        client.DefaultRequestHeaders.Remove("Authorization");
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
        return client;
    }

    private async Task<T> HandleResponseAsync<T>(HttpResponseMessage response, CancellationToken ct)
    {
        var json = await response.Content.ReadAsStringAsync(ct);

        UpstoxEnvelope<T>? envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<UpstoxEnvelope<T>>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException(
                $"Failed to deserialize Upstox market data response: {ex.Message}");
        }

        if (envelope?.Status != "success" || envelope.Data is null)
        {
            var msg = envelope?.Errors?.FirstOrDefault()?.Message
                      ?? $"Upstox market data API error (HTTP {(int)response.StatusCode})";
            throw new InvalidOperationException(msg);
        }

        return envelope.Data;
    }

    // ──────────────────────────────────────────────────
    // Option chain mapping
    // ──────────────────────────────────────────────────

    private static OptionChainEntry MapChainEntry(RawOptionChainEntry e) => new()
    {
        Expiry              = e.Expiry ?? "",
        Pcr                 = e.Pcr,
        StrikePrice         = e.StrikePrice,
        UnderlyingKey       = e.UnderlyingKey ?? "",
        UnderlyingSpotPrice = e.UnderlyingSpotPrice,
        CallOptions         = MapSide(e.CallOptions),
        PutOptions          = MapSide(e.PutOptions),
    };

    private static OptionSide? MapSide(RawOptionSide? s) =>
        s is null ? null : new()
        {
            InstrumentKey = s.InstrumentKey ?? "",
            MarketData    = MapMarketData(s.MarketData),
            OptionGreeks  = MapGreeks(s.OptionGreeks),
        };

    private static OptionMarketData? MapMarketData(RawOptionMarketData? m) =>
        m is null ? null : new()
        {
            Ltp        = m.Ltp,
            Volume     = m.Volume,
            Oi         = m.Oi,
            PrevOi     = m.PrevOi,
            ClosePrice = m.ClosePrice,
            BidPrice   = m.BidPrice,
            BidQty     = m.BidQty,
            AskPrice   = m.AskPrice,
            AskQty     = m.AskQty,
        };

    private static OptionGreeks? MapGreeks(RawOptionGreeks? g) =>
        g is null ? null : new()
        {
            Vega  = g.Vega,
            Theta = g.Theta,
            Gamma = g.Gamma,
            Delta = g.Delta,
            Iv    = g.Iv,
            Pop   = g.Pop,
        };

    // ──────────────────────────────────────────────────
    // Internal DTOs (serialisation only)
    // ──────────────────────────────────────────────────

    private sealed class UpstoxEnvelope<T>
    {
        [JsonPropertyName("status")] public string? Status { get; init; }
        [JsonPropertyName("data")]   public T?      Data   { get; init; }
        [JsonPropertyName("errors")] public List<ApiErrorDto>? Errors { get; init; }
    }

    private sealed class ApiErrorDto
    {
        [JsonPropertyName("message")] public string? Message { get; init; }
    }

    private sealed class AuthorizeResponse
    {
        [JsonPropertyName("authorizedRedirectUri")] public string? AuthorizedRedirectUri { get; init; }
    }

    private sealed class CandlesWrapper
    {
        [JsonPropertyName("status")] public string?          Status { get; init; }
        [JsonPropertyName("data")]   public CandlesDataDto?  Data   { get; init; }
    }

    private sealed class CandlesDataDto
    {
        [JsonPropertyName("candles")] public List<List<JsonElement>>? Candles { get; init; }
    }

    // Raw option chain DTOs (snake_case from Upstox API)
    private sealed class RawOptionChainEntry
    {
        [JsonPropertyName("expiry")]               public string?          Expiry              { get; init; }
        [JsonPropertyName("pcr")]                  public decimal          Pcr                 { get; init; }
        [JsonPropertyName("strike_price")]         public decimal          StrikePrice         { get; init; }
        [JsonPropertyName("underlying_key")]       public string?          UnderlyingKey       { get; init; }
        [JsonPropertyName("underlying_spot_price")]public decimal          UnderlyingSpotPrice { get; init; }
        [JsonPropertyName("call_options")]         public RawOptionSide?   CallOptions         { get; init; }
        [JsonPropertyName("put_options")]          public RawOptionSide?   PutOptions          { get; init; }
    }

    private sealed class RawOptionSide
    {
        [JsonPropertyName("instrument_key")] public string?              InstrumentKey { get; init; }
        [JsonPropertyName("market_data")]    public RawOptionMarketData? MarketData    { get; init; }
        [JsonPropertyName("option_greeks")] public RawOptionGreeks?     OptionGreeks  { get; init; }
    }

    private sealed class RawOptionMarketData
    {
        [JsonPropertyName("ltp")]         public decimal Ltp        { get; init; }
        [JsonPropertyName("volume")]      public long    Volume     { get; init; }
        [JsonPropertyName("oi")]          public decimal Oi         { get; init; }
        [JsonPropertyName("prev_oi")]     public decimal PrevOi     { get; init; }
        [JsonPropertyName("close_price")] public decimal ClosePrice { get; init; }
        [JsonPropertyName("bid_price")]   public decimal BidPrice   { get; init; }
        [JsonPropertyName("bid_qty")]     public long    BidQty     { get; init; }
        [JsonPropertyName("ask_price")]   public decimal AskPrice   { get; init; }
        [JsonPropertyName("ask_qty")]     public long    AskQty     { get; init; }
    }

    private sealed class RawOptionGreeks
    {
        [JsonPropertyName("vega")]  public decimal Vega  { get; init; }
        [JsonPropertyName("theta")] public decimal Theta { get; init; }
        [JsonPropertyName("gamma")] public decimal Gamma { get; init; }
        [JsonPropertyName("delta")] public decimal Delta { get; init; }
        [JsonPropertyName("iv")]    public decimal Iv    { get; init; }
        [JsonPropertyName("pop")]   public decimal Pop   { get; init; }
    }

    // Raw option contract DTO — used by UpstoxOptionContractProvider
    internal sealed class RawOptionContract
    {
        [JsonPropertyName("expiry")]          public string  Expiry          { get; init; } = "";
        [JsonPropertyName("instrument_key")]  public string  InstrumentKey   { get; init; } = "";
        [JsonPropertyName("exchange_token")]  public string  ExchangeToken   { get; init; } = "";
        [JsonPropertyName("lot_size")]        public decimal LotSize         { get; init; }
        [JsonPropertyName("instrument_type")] public string  InstrumentType  { get; init; } = "";
        [JsonPropertyName("strike_price")]    public decimal StrikePrice     { get; init; }
    }
}
