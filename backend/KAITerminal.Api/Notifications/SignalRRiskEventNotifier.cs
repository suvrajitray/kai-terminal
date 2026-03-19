using KAITerminal.Api.Hubs;
using KAITerminal.Contracts.Notifications;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Notifications;

internal sealed class SignalRRiskEventNotifier : IRiskEventNotifier
{
    private readonly IHubContext<RiskHub> _hub;

    public SignalRRiskEventNotifier(IHubContext<RiskHub> hub)
    {
        _hub = hub;
    }

    public Task NotifyAsync(RiskNotification notification, CancellationToken ct = default)
        => _hub.Clients.Group(notification.UserId)
               .SendAsync("ReceiveRiskEvent", notification, ct);
}
