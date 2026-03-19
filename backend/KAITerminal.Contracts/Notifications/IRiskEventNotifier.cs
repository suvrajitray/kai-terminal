using System.Text.Json.Serialization;

namespace KAITerminal.Contracts.Notifications;

public interface IRiskEventNotifier
{
    Task NotifyAsync(RiskNotification notification, CancellationToken ct = default);
}

public sealed record RiskNotification(
    string               UserId,
    string               Broker,
    RiskNotificationType Type,
    decimal              Mtm,
    decimal?             Target           = null,
    decimal?             Sl               = null,
    decimal?             TslFloor         = null,
    int?                 OpenPositionCount = null,
    DateTimeOffset       Timestamp        = default);

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RiskNotificationType
{
    SessionStarted,
    HardSlHit,
    TargetHit,
    TslActivated,
    TslRaised,
    TslHit,
    SquareOffComplete,
    SquareOffFailed,
}
