using KAITerminal.Contracts.Notifications;

namespace KAITerminal.RiskEngine.Notifications;

internal sealed class NullRiskEventNotifier : IRiskEventNotifier
{
    public Task NotifyAsync(RiskNotification notification, CancellationToken ct = default)
        => Task.CompletedTask;
}
