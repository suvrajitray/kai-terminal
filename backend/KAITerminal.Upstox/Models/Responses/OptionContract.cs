using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.Responses;

/// <summary>A single option contract from the /v2/option/contract endpoint.</summary>
public sealed class OptionContract
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = "";

    [JsonPropertyName("segment")]
    public string Segment { get; init; } = "";

    [JsonPropertyName("exchange")]
    public string Exchange { get; init; } = "";

    [JsonPropertyName("expiry")]
    public string Expiry { get; init; } = "";

    /// <summary>Instrument key used for placing orders (e.g. NSE_FO|37590).</summary>
    [JsonPropertyName("instrument_key")]
    public string InstrumentKey { get; init; } = "";

    [JsonPropertyName("exchange_token")]
    public string ExchangeToken { get; init; } = "";

    [JsonPropertyName("trading_symbol")]
    public string TradingSymbol { get; init; } = "";

    [JsonPropertyName("tick_size")]
    public decimal TickSize { get; init; }

    [JsonPropertyName("lot_size")]
    public int LotSize { get; init; }

    /// <summary>CE or PE.</summary>
    [JsonPropertyName("instrument_type")]
    public string InstrumentType { get; init; } = "";

    [JsonPropertyName("freeze_quantity")]
    public int FreezeQuantity { get; init; }

    [JsonPropertyName("underlying_key")]
    public string UnderlyingKey { get; init; } = "";

    [JsonPropertyName("underlying_type")]
    public string UnderlyingType { get; init; } = "";

    [JsonPropertyName("underlying_symbol")]
    public string UnderlyingSymbol { get; init; } = "";

    [JsonPropertyName("strike_price")]
    public decimal StrikePrice { get; init; }

    [JsonPropertyName("minimum_lot")]
    public int MinimumLot { get; init; }

    [JsonPropertyName("weekly")]
    public bool Weekly { get; init; }
}
