namespace KAITerminal.Contracts.Constants;

public static class ExchangeConstants
{
    public static readonly IReadOnlySet<string> OptionsExchanges =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "NFO", "BFO" };

    public static readonly IReadOnlySet<string> IndexUnderlyings =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "NIFTY", "BANKNIFTY", "SENSEX", "BANKEX", "FINNIFTY" };
}
