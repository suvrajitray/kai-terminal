using System.Text.Json.Serialization;

namespace KAITerminal.Upstox.Models.Responses;

/// <summary>A single strike row from the /v2/option/chain endpoint (put + call side).</summary>
public sealed class OptionChainEntry
{
    [JsonPropertyName("expiry")]
    public string Expiry { get; init; } = "";

    [JsonPropertyName("pcr")]
    public decimal Pcr { get; init; }

    [JsonPropertyName("strike_price")]
    public decimal StrikePrice { get; init; }

    [JsonPropertyName("underlying_key")]
    public string UnderlyingKey { get; init; } = "";

    [JsonPropertyName("underlying_spot_price")]
    public decimal UnderlyingSpotPrice { get; init; }

    [JsonPropertyName("call_options")]
    public OptionSide? CallOptions { get; init; }

    [JsonPropertyName("put_options")]
    public OptionSide? PutOptions { get; init; }
}

public sealed class OptionSide
{
    [JsonPropertyName("instrument_key")]
    public string InstrumentKey { get; init; } = "";

    [JsonPropertyName("market_data")]
    public OptionMarketData? MarketData { get; init; }

    [JsonPropertyName("option_greeks")]
    public OptionGreeks? OptionGreeks { get; init; }
}

public sealed class OptionMarketData
{
    [JsonPropertyName("ltp")]
    public decimal Ltp { get; init; }

    [JsonPropertyName("volume")]
    public decimal Volume { get; init; }

    [JsonPropertyName("oi")]
    public decimal Oi { get; init; }

    [JsonPropertyName("prev_oi")]
    public decimal PrevOi { get; init; }

    [JsonPropertyName("close_price")]
    public decimal ClosePrice { get; init; }

    [JsonPropertyName("bid_price")]
    public decimal BidPrice { get; init; }

    [JsonPropertyName("bid_qty")]
    public decimal BidQty { get; init; }

    [JsonPropertyName("ask_price")]
    public decimal AskPrice { get; init; }

    [JsonPropertyName("ask_qty")]
    public decimal AskQty { get; init; }
}

public sealed class OptionGreeks
{
    [JsonPropertyName("vega")]
    public decimal Vega { get; init; }

    [JsonPropertyName("theta")]
    public decimal Theta { get; init; }

    [JsonPropertyName("gamma")]
    public decimal Gamma { get; init; }

    [JsonPropertyName("delta")]
    public decimal Delta { get; init; }

    [JsonPropertyName("iv")]
    public decimal Iv { get; init; }

    /// <summary>Probability of Profit (%).</summary>
    [JsonPropertyName("pop")]
    public decimal Pop { get; init; }
}
