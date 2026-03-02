namespace KAITerminal.Upstox.Models.Enums;

public enum OrderType
{
    Market,
    Limit,
    /// <summary>Stop-loss limit order. Requires TriggerPrice.</summary>
    SL,
    /// <summary>Stop-loss market order. Requires TriggerPrice.</summary>
    SLM
}
