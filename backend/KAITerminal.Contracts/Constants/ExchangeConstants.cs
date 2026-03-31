namespace KAITerminal.Contracts.Constants;

public static class ExchangeConstants
{
    public static readonly IReadOnlySet<string> OptionsExchanges = 
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "NFO", "BFO" };
}
