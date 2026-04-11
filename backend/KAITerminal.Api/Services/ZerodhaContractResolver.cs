using KAITerminal.MarketData.Models;
using KAITerminal.MarketData.Services;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Api.Services;

/// <summary>
/// Resolves a Zerodha option contract from an Upstox-style instrument key
/// (format: <c>"{exchange}|{exchange_token}"</c>, e.g. <c>"NSE_FO|12345678"</c>).
/// </summary>
internal static class ZerodhaContractResolver
{
    /// <summary>
    /// Loads the current-year Kite contract list and finds the entry whose
    /// <c>ExchangeToken</c> matches the token encoded in <paramref name="upstoxKey"/>.
    /// </summary>
    /// <returns>
    /// The matched contract and its exchange token.
    /// <c>Match</c> is <c>null</c> when no contract is found.
    /// </returns>
    public static async Task<(ZerodhaOptionContract? Match, string ExchangeToken)> ResolveAsync(
        string upstoxKey, IZerodhaInstrumentService instruments, CancellationToken ct)
    {
        var exchangeToken = upstoxKey.Contains('|') ? upstoxKey.Split('|')[1] : upstoxKey;
        var contracts     = await instruments.GetAllCurrentYearContractsAsync(ct);
        var match         = contracts.FirstOrDefault(c => c.ExchangeToken == exchangeToken);
        return (match, exchangeToken);
    }
}
