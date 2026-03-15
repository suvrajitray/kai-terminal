using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

public interface IChartDataService
{
    Task<IReadOnlyList<CandleData>> GetHistoricalCandlesAsync(
        string instrumentKey, CandleInterval interval, DateOnly from, DateOnly to,
        CancellationToken ct = default);

    Task<IReadOnlyList<CandleData>> GetIntradayCandlesAsync(
        string instrumentKey, CandleInterval interval,
        CancellationToken ct = default);

    Task<IReadOnlyList<InstrumentSearchResult>> SearchInstrumentsAsync(
        string query, CancellationToken ct = default);
}
