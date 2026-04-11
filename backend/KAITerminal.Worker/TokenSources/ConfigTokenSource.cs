using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.Worker;

/// <summary>
/// Reads the list of users from <c>RiskEngine:Users[]</c> in configuration.
/// Kept for backwards compatibility / local dev use. Prefer <see cref="DbUserTokenSource"/> in production.
/// </summary>
public sealed class ConfigTokenSource : IUserTokenSource
{
    public Task<IReadOnlyList<UserConfig>> GetUsersAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<UserConfig>>([]);
}
