namespace KAITerminal.Contracts.Streaming;

/// <summary>
/// Broker-agnostic LTP tick event.
/// Replaces Upstox's <c>MarketDataMessage</c> in cross-project code.
/// </summary>
/// <param name="Ltps">Map of instrument token → last traded price.</param>
public sealed record LtpUpdate(IReadOnlyDictionary<string, decimal> Ltps);
