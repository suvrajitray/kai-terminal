using KAITerminal.Infrastructure.Data;

namespace KAITerminal.Infrastructure.Services;

public interface IAutoEntryConfigService
{
    Task<List<AutoEntryConfig>> GetAllForUserAsync(string username, CancellationToken ct = default);
    Task<AutoEntryConfig?> GetByIdAsync(int id, string username, CancellationToken ct = default);
    Task<AutoEntryConfig> CreateAsync(string username, AutoEntryConfig template, CancellationToken ct = default);
    Task<AutoEntryConfig?> UpdateAsync(int id, string username, AutoEntryConfig patch, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, string username, CancellationToken ct = default);
    Task<List<AutoEntryConfig>> GetAllEnabledAsync(CancellationToken ct = default);
    Task<bool> HasEnteredTodayAsync(int strategyId, string todayIst, CancellationToken ct = default);
    Task LogEntryAsync(int strategyId, string instrument, string todayIst, DateTime enteredAtUtc, CancellationToken ct = default);
    Task<List<AutoEntryLog>> GetTodayLogsForUserAsync(string username, string todayIst, CancellationToken ct = default);
}
