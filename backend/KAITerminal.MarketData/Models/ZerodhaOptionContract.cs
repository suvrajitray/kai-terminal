namespace KAITerminal.MarketData.Models;

/// <summary>
/// A single option contract from the Kite Connect instruments CSV
/// (api.kite.trade/instruments/{exchange}).
/// </summary>
public sealed record ZerodhaOptionContract(
    string InstrumentToken,   // instrument_token — raw numeric string, e.g. "15942914"
    string ExchangeToken,     // exchange_token   — exchange-level token
    string TradingSymbol,     // tradingsymbol    — e.g. "NIFTY26MAR24000CE"
    string Name,              // name             — underlying name, e.g. "NIFTY"
    decimal LastPrice,        // last_price
    string Expiry,            // expiry           — "2026-03-27"
    decimal Strike,           // strike
    decimal TickSize,         // tick_size
    decimal LotSize,          // lot_size
    string InstrumentType,    // instrument_type  — "CE" | "PE"
    string Segment,           // segment          — "NFO-OPT" | "BFO-OPT"
    string Exchange,          // exchange         — "NFO" | "BFO"
    bool Weekly
);
