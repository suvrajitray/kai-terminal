using KAITerminal.Broker;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Notifications;

internal sealed class NullAutoShiftEvaluator : IAutoShiftEvaluator
{
    public Task EvaluateAsync(string userId, UserConfig config, IBrokerClient broker, CancellationToken ct)
        => Task.CompletedTask;
}
