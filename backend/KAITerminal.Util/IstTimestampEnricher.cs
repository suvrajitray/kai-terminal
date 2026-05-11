using Serilog.Core;
using Serilog.Events;

namespace KAITerminal.Util;

/// <summary>
/// Adds a <c>TimestampIst</c> log property containing the event timestamp converted to
/// Asia/Kolkata (IST, UTC+5:30). Use <c>{TimestampIst:HH:mm:ss}</c> in the output template
/// so logs show IST regardless of the server's local timezone.
/// </summary>
public sealed class IstTimestampEnricher : ILogEventEnricher
{
    private static readonly TimeZoneInfo Ist =
        TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");

    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        var ist = TimeZoneInfo.ConvertTime(logEvent.Timestamp, Ist);
        logEvent.AddOrUpdateProperty(propertyFactory.CreateProperty("TimestampIst", ist));
    }
}
