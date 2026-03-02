using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Abstractions;

/// <summary>
/// Provides the list of users (id + access token) the risk engine should monitor.
/// Implementations differ between the Worker (multi-user from config) and
/// the Console (single user from config).
/// </summary>
public interface IUserTokenSource
{
    IReadOnlyList<UserConfig> GetUsers();
}
