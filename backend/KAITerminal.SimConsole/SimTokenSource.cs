using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.SimConsole;

/// <summary>Returns a single hardcoded simulated user. No real token needed.</summary>
public sealed class SimTokenSource : IUserTokenSource
{
    public IReadOnlyList<UserConfig> GetUsers() =>
        [new UserConfig { UserId = "sim-user", AccessToken = "sim-token" }];
}
