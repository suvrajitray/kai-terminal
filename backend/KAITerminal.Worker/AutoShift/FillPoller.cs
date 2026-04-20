using KAITerminal.Broker;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker;

/// <summary>
/// Polls a broker's order book until all order IDs reach "complete" status or timeout elapses.
/// </summary>
internal static class FillPoller
{
    /// <summary>
    /// Polls until all <paramref name="orderIds"/> (comma-separated for sliced orders) fill,
    /// or until <paramref name="timeoutSeconds"/> elapses. Returns on success.
    /// Throws <see cref="InvalidOperationException"/> if any order is rejected.
    /// On timeout, logs a warning and returns so the open order can still be attempted.
    /// </summary>
    public static async Task WaitForFillAsync(
        IBrokerClient broker, string orderIds, int timeoutSeconds,
        string userId, string chainKey, ILogger logger, CancellationToken ct)
    {
        var ids = orderIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                          .ToHashSet(StringComparer.Ordinal);

        var deadline = DateTimeOffset.UtcNow.AddSeconds(timeoutSeconds);

        logger.LogInformation(
            "AutoShift waiting for fill — orderIds={OrderIds} timeout={Timeout}s chain={ChainKey} [{UserId}]",
            orderIds, timeoutSeconds, chainKey, userId);

        while (DateTimeOffset.UtcNow < deadline)
        {
            try
            {
                var orders  = await broker.GetAllOrdersAsync(ct);
                var matched = orders.Where(o => ids.Contains(o.OrderId)).ToList();

                var rejected = matched.FirstOrDefault(o =>
                    o.Status.Equals("rejected", StringComparison.OrdinalIgnoreCase));
                if (rejected is not null)
                    throw new InvalidOperationException(
                        $"Close order {rejected.OrderId} was rejected: {rejected.StatusMessage}");

                if (matched.Count > 0 &&
                    matched.All(o => o.Status.Equals("complete", StringComparison.OrdinalIgnoreCase)))
                {
                    logger.LogInformation(
                        "AutoShift close order filled — orderIds={OrderIds} chain={ChainKey} [{UserId}]",
                        orderIds, chainKey, userId);
                    return;
                }
            }
            catch (InvalidOperationException) { throw; }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "AutoShift WaitForFillAsync: transient error polling orders — will retry | chain={ChainKey} orderIds={OrderIds} [{UserId}]",
                    chainKey, orderIds, userId);
            }

            await Task.Delay(500, ct);
        }

        logger.LogWarning(
            "AutoShift WaitForFillAsync: timed out after {Timeout}s for orderIds={OrderIds} chain={ChainKey} — proceeding with open order anyway [{UserId}]",
            timeoutSeconds, orderIds, chainKey, userId);
    }
}
