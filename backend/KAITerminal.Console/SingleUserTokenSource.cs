using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using KAITerminal.Upstox.Configuration;
using Microsoft.Extensions.Options;

namespace KAITerminal.Console;

/// <summary>
/// Reads a single user's access token from <c>Upstox:AccessToken</c> in configuration.
/// The UserId is set to the literal string "console".
/// Suitable for single-developer use (Console project).
/// </summary>
public sealed class SingleUserTokenSource : IUserTokenSource
{
    private readonly IReadOnlyList<UserConfig> _users;

    public SingleUserTokenSource(IOptions<UpstoxConfig> cfg)
    {
        _users = [new UserConfig { UserId = "Console", AccessToken = cfg.Value.AccessToken ?? "" }];
    }

    public Task<IReadOnlyList<UserConfig>> GetUsersAsync(CancellationToken ct = default) =>
        Task.FromResult(_users);
}
