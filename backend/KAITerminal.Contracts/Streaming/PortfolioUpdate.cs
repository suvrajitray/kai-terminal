namespace KAITerminal.Contracts.Streaming;

/// <summary>
/// Broker-agnostic portfolio event.
/// <para>
/// <paramref name="UpdateType"/> values: "order_update" | "position_update" (Upstox),
/// or broker-equivalent strings. Optional fields are populated for order events.
/// </para>
/// </summary>
public sealed record PortfolioUpdate(
    string  UpdateType,
    string? OrderId       = null,
    string? Status        = null,
    string? StatusMessage = null,
    string? TradingSymbol = null);
