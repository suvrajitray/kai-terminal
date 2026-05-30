using System.Net.Http.Json;
using System.Text.Json.Serialization;
using KAITerminal.Upstox.Models;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Http;

internal sealed partial class UpstoxHttpClient
{
    public Task<IReadOnlyList<Position>> GetPositionsAsync(CancellationToken ct = default)
        => GetListAsync<Position>("UpstoxApi", "/v2/portfolio/short-term-positions", ct);

    public async Task ConvertPositionAsync(
        string instrumentToken, string oldProduct, string newProduct,
        string transactionType, int quantity, CancellationToken ct = default)
    {
        var dto = new ConvertPositionDto
        {
            InstrumentToken = instrumentToken,
            OldProduct = oldProduct,
            NewProduct = newProduct,
            TransactionType = transactionType,
            Quantity = quantity
        };
        var client = _factory.CreateClient("UpstoxApi");
        var response = await client.PutAsJsonAsync("/v2/portfolio/convert-position", dto, JsonOptions, ct);
        await HandleResponseAsync<object>(response, ct);
    }

    public async Task<FundsResponse> GetFundsAsync(CancellationToken ct = default)
    {
        var data = await GetObjectAsync<FundsDataDto>("UpstoxApi", "/v2/user/get-funds-and-margin?segment=SEC", ct);
        var eq   = data.Equity ?? new FundsEquityDto();
        return new FundsResponse
        {
            AvailableMargin = eq.AvailableMargin,
            UsedMargin      = eq.UsedMargin,
            PayinAmount     = eq.PayinAmount,
        };
    }

    private sealed class ConvertPositionDto
    {
        [JsonPropertyName("instrument_token")] public string InstrumentToken { get; init; } = "";
        [JsonPropertyName("new_product")]      public string NewProduct      { get; init; } = "";
        [JsonPropertyName("old_product")]      public string OldProduct      { get; init; } = "";
        [JsonPropertyName("transaction_type")] public string TransactionType { get; init; } = "";
        [JsonPropertyName("quantity")]         public int    Quantity        { get; init; }
    }

    private sealed class FundsDataDto
    {
        [JsonPropertyName("equity")] public FundsEquityDto? Equity { get; init; }
    }

    private sealed class FundsEquityDto
    {
        [JsonPropertyName("available_margin")] public decimal AvailableMargin { get; init; }
        [JsonPropertyName("used_margin")]      public decimal UsedMargin      { get; init; }
        [JsonPropertyName("payin_amount")]     public decimal PayinAmount     { get; init; }
    }
}
