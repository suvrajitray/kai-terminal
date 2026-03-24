using KAITerminal.Zerodha.Models;

namespace KAITerminal.Zerodha.Services;

public interface IZerodhaInstrumentService
{
    /// <summary>
    /// Returns all CE/PE option contracts for the given underlying that expire
    /// within the current calendar year, sourced from NFO and BFO instrument dumps.
    /// </summary>
    Task<IReadOnlyList<ZerodhaOptionContract>> GetCurrentYearContractsAsync(
        string underlyingSymbol, CancellationToken ct = default);

    /// <summary>
    /// Returns all CE/PE option contracts across all supported underlyings that expire
    /// within the current calendar year. Downloads NFO + BFO CSVs once (in parallel)
    /// rather than once per underlying symbol.
    /// </summary>
    Task<IReadOnlyList<ZerodhaOptionContract>> GetAllCurrentYearContractsAsync(CancellationToken ct = default);
}
