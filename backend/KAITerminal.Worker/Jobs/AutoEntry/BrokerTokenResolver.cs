using KAITerminal.Contracts;
using KAITerminal.Contracts.Options;

namespace KAITerminal.Worker.Jobs.AutoEntry;

internal static class BrokerTokenResolver
{
    public static StrikeResolution? FromContract(
        ContractEntry contract, string brokerType, string instrument)
    {
        if (brokerType.Equals(BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
            return new StrikeResolution(contract.UpstoxToken, Exchange: null);

        if (string.IsNullOrEmpty(contract.ZerodhaToken))
            return null;

        return new StrikeResolution(contract.ZerodhaToken, ZerodhaExchange(instrument));
    }

    public static StrikeResolution? FromUpstoxKey(
        string upstoxKey, string brokerType,
        IReadOnlyList<ContractEntry> contracts, string instrument)
    {
        // Option chain InstrumentKey uses ':' (e.g. "NSE_FO:57520"); ContractEntry.UpstoxToken uses '|'
        var normalizedKey = upstoxKey.Replace(':', '|');

        if (brokerType.Equals(BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
            return new StrikeResolution(normalizedKey, Exchange: null);

        var exchangeToken = normalizedKey.Contains('|')
            ? normalizedKey.Split('|')[1]
            : normalizedKey;

        var match = contracts.FirstOrDefault(c =>
            c.UpstoxToken.Contains('|') &&
            c.UpstoxToken.Split('|')[1].Equals(exchangeToken, StringComparison.OrdinalIgnoreCase));

        if (match is null || string.IsNullOrEmpty(match.ZerodhaToken))
            return null;

        return new StrikeResolution(match.ZerodhaToken, ZerodhaExchange(instrument));
    }

    private static string ZerodhaExchange(string instrument) =>
        instrument is "SENSEX" or "BANKEX" ? "BFO" : "NFO";
}
