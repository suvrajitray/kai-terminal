using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Zerodha.Services;

public interface IZerodhaInstrumentService
{
    /// <summary>
    /// Returns all CE/PE option contracts for the given underlying that expire
    /// within the current calendar year, sourced from NFO and BFO instrument dumps.
    /// </summary>
    Task<IReadOnlyList<OptionContract>> GetCurrentYearContractsAsync(
        string underlyingSymbol, CancellationToken ct = default);
}
