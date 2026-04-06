using KAITerminal.Api.Hubs;
using KAITerminal.Contracts.Notifications;
using KAITerminal.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.Api.Notifications;

internal sealed class SignalRRiskEventNotifier : IRiskEventNotifier
{
    private readonly IHubContext<RiskHub>  _hub;
    private readonly IServiceScopeFactory  _scopeFactory;

    public SignalRRiskEventNotifier(IHubContext<RiskHub> hub, IServiceScopeFactory scopeFactory)
    {
        _hub          = hub;
        _scopeFactory = scopeFactory;
    }

    public async Task NotifyAsync(RiskNotification notification, CancellationToken ct = default)
    {
        // Persist to DB
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.RiskEngineLogs.Add(new RiskEngineLog
        {
            Username         = notification.UserId,
            BrokerType       = notification.Broker,
            EventType        = notification.Type.ToString(),
            Mtm              = notification.Mtm,
            Sl               = notification.Sl,
            Target           = notification.Target,
            TslFloor         = notification.TslFloor,
            InstrumentToken  = notification.InstrumentToken,
            ShiftCount       = notification.ShiftCount,
            Timestamp        = notification.Timestamp == default ? DateTimeOffset.UtcNow : notification.Timestamp,
        });
        await db.SaveChangesAsync(ct);

        // Broadcast to user's SignalR group
        await _hub.Clients.Group(notification.UserId)
                  .SendAsync("ReceiveRiskEvent", notification, ct);
    }
}
