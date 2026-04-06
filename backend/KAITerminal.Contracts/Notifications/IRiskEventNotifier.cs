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
    decimal?             Target            = null,
    decimal?             Sl                = null,
    decimal?             TslFloor          = null,
    int?                 OpenPositionCount = null,
    DateTimeOffset       Timestamp         = default,
    string?              InstrumentToken   = null,   // position that triggered auto-shift
    string?              NewToken          = null,   // new position opened (AutoShiftTriggered)
    int?                 ShiftCount        = null);  // cumulative auto-shifts for this chain

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
    AutoShiftTriggered,   // sell position shifted further OTM automatically
    AutoShiftExhausted,   // max auto-shifts reached — position exited
    AutoShiftFailed,      // auto-shift attempted but failed (order error / contract not found)
    AutoSquareOff,        // auto square-off triggered at configured time
    StatusUpdate,         // periodic PnL snapshot (rate-limited, max once per 15 min per broker)
}
