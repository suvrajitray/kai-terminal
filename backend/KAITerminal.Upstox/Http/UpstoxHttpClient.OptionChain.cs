using System.Text.Json.Serialization;
using KAITerminal.Upstox.Models;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Http;

internal sealed partial class UpstoxHttpClient
{
    public Task<IReadOnlyList<OptionChainEntry>> GetOptionChainAsync(
        string underlyingKey, string expiryDate, CancellationToken ct = default)
    {
        var ek   = Uri.EscapeDataString(underlyingKey);
        var path = $"/v2/option/chain?instrument_key={ek}&expiry_date={Uri.EscapeDataString(expiryDate)}";
        return GetListAsync<OptionChainEntry>("UpstoxApi", path, ct);
    }

    public Task<IReadOnlyList<OptionContract>> GetOptionContractsAsync(
        string underlyingKey, string? expiryDate = null, CancellationToken ct = default)
    {
        var ek   = Uri.EscapeDataString(underlyingKey);
        var path = $"/v2/option/contract?instrument_key={ek}";
        if (!string.IsNullOrEmpty(expiryDate))
            path += $"&expiry_date={Uri.EscapeDataString(expiryDate)}";
        return GetListAsync<OptionContract>("UpstoxApi", path, ct);
    }

    public Task<MarginResponse> GetRequiredMarginAsync(
        IEnumerable<MarginOrderItem> items, CancellationToken ct = default)
    {
        var dto = new MarginRequestDto
        {
            Instruments = items.Select(i => new MarginInstrumentDto
            {
                InstrumentToken = i.InstrumentToken,
                Quantity        = i.Quantity,
                Product         = i.Product,
                TransactionType = i.TransactionType,
                Price           = 0
            }).ToList()
        };
        return PostAsync<MarginResponse>("UpstoxApi", "/v2/charges/margin", dto, ct);
    }

    private sealed class MarginRequestDto
    {
        [JsonPropertyName("instruments")] public List<MarginInstrumentDto> Instruments { get; init; } = [];
    }

    private sealed class MarginInstrumentDto
    {
        [JsonPropertyName("instrument_key")]   public string  InstrumentToken { get; init; } = "";
        [JsonPropertyName("quantity")]         public int     Quantity        { get; init; }
        [JsonPropertyName("product")]          public string  Product         { get; init; } = "";
        [JsonPropertyName("transaction_type")] public string  TransactionType { get; init; } = "";
        [JsonPropertyName("price")]            public decimal Price           { get; init; }
    }
}
