namespace KAITerminal.Upstox.Models.Responses;

/// <summary>Result from the v2 place-order endpoint.</summary>
public sealed class PlaceOrderResult
{
    public string OrderId { get; init; } = "";
}

/// <summary>Result from the v3 (HFT) place-order endpoint. Supports auto-slicing.</summary>
public sealed class PlaceOrderV3Result
{
    /// <summary>
    /// One or more order IDs. Multiple IDs are returned when the order was
    /// auto-sliced by the exchange freeze-quantity limit (slice=true).
    /// </summary>
    public IReadOnlyList<string> OrderIds { get; init; } = [];

    /// <summary>End-to-end API latency in milliseconds as reported by Upstox.</summary>
    public int Latency { get; init; }
}
