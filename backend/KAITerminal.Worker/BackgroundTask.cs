using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker;

/// <summary>
/// Helper for detached background work. Captures any unhandled exception from
/// <paramref name="action"/> and logs it with the caller-supplied tag and Serilog
/// message template, preserving the structured fields so log sinks can still index
/// each value by name.
/// </summary>
internal static class BackgroundTask
{
    /// <param name="logger">Sink for crash logs.</param>
    /// <param name="tag">Five-char log tag (e.g. <c>"SHIFT"</c>) consistent with the project logging convention.</param>
    /// <param name="messageTemplate">
    /// Serilog message template describing the crash context. Must end in a period
    /// and contain only the <em>context</em> — the helper appends a fixed " CRASHED — ..."
    /// prefix and a "Manual intervention required." suffix.
    /// </param>
    /// <param name="args">Values for the template's placeholders, in order.</param>
    /// <param name="action">The work to run.</param>
    public static void RunDetached(
        ILogger        logger,
        string         tag,
        string         messageTemplate,
        object?[]      args,
        Func<Task>     action)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await action();
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    $"[{tag,-5}] Background task CRASHED — {messageTemplate}  |  Manual intervention required.",
                    args);
            }
        });
    }
}
