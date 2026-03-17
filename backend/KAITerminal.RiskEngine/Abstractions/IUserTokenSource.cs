using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Abstractions;

/// <summary>
/// Provides the list of users (id + access token + thresholds) the risk engine should monitor.
/// Implementations differ between the Worker (multi-user from DB) and
/// the Console (single user from config).
/// </summary>
public interface IUserTokenSource
{
    Task<IReadOnlyList<UserConfig>> GetUsersAsync(CancellationToken ct = default);
}
