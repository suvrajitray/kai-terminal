using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Models;
using Microsoft.Extensions.Options;

namespace KAITerminal.Worker;

/// <summary>
/// Reads the list of users from <c>RiskEngine:Users[]</c> in configuration.
/// Suitable for multi-user deployments (Worker service).
/// </summary>
public sealed class ConfigTokenSource : IUserTokenSource
{
    private readonly RiskEngineConfig _cfg;

    public ConfigTokenSource(IOptions<RiskEngineConfig> cfg) => _cfg = cfg.Value;

    public IReadOnlyList<UserConfig> GetUsers() => _cfg.Users;
}
