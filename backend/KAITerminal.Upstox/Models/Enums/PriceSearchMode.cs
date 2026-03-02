namespace KAITerminal.Upstox.Models.Enums;

/// <summary>
/// Controls how the SDK searches the option chain when resolving a strike by premium.
/// </summary>
public enum PriceSearchMode
{
    /// <summary>
    /// Select the strike whose LTP is closest to <c>TargetPremium</c> (default behaviour).
    /// </summary>
    Nearest,

    /// <summary>
    /// Select the strike with the smallest LTP that is strictly greater than <c>TargetPremium</c>.
    /// </summary>
    GreaterThan,

    /// <summary>
    /// Select the strike with the largest LTP that is strictly less than <c>TargetPremium</c>.
    /// </summary>
    LessThan,
}
