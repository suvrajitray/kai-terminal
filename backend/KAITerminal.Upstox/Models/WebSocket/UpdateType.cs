namespace KAITerminal.Upstox.Models.WebSocket;

public enum UpdateType
{
    /// <summary>Receive order status updates.</summary>
    Order,

    /// <summary>Receive position updates.</summary>
    Position,

    /// <summary>Receive holding updates.</summary>
    Holding,

    /// <summary>Receive GTT order updates.</summary>
    GttOrder
}
