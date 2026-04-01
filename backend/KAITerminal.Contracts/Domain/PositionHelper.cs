namespace KAITerminal.Contracts.Domain;

/// <summary>Centralised helpers for position quantity → transaction type derivation.</summary>
public static class PositionHelper
{
    /// <summary>
    /// Returns the transaction type needed to close a position:
    /// SELL to close a long (qty &gt; 0), BUY to close a short (qty &lt; 0).
    /// </summary>
    public static string CloseTransactionType(int quantity) => quantity > 0 ? "SELL" : "BUY";

    /// <summary>
    /// Returns the transaction type reflecting a position's opening side:
    /// BUY for long or flat (qty &gt;= 0), SELL for short (qty &lt; 0).
    /// Used for position conversion requests.
    /// </summary>
    public static string ConvertTransactionType(int quantity) => quantity >= 0 ? "BUY" : "SELL";
}
