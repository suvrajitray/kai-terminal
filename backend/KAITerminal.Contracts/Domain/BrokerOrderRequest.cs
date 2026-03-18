namespace KAITerminal.Contracts.Domain;

/// <summary>Broker-agnostic order placement parameters.</summary>
/// <param name="InstrumentToken">Broker-specific instrument identifier.</param>
/// <param name="Quantity">Number of units.</param>
/// <param name="TransactionType">"BUY" or "SELL".</param>
/// <param name="Product">Product code: "I"/"MIS" (intraday), "D"/"CNC" (delivery), "NRML" (F&amp;O carry).</param>
/// <param name="OrderType">"MARKET" or "LIMIT".</param>
/// <param name="Price">Limit price; ignored for market orders.</param>
public sealed record BrokerOrderRequest(
    string   InstrumentToken,
    int      Quantity,
    string   TransactionType,
    string   Product,
    string   OrderType,
    decimal? Price = null);
