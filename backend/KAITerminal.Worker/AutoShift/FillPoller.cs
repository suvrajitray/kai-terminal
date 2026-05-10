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
            "[FILL ] Waiting — orderIds={OrderIds} timeout={Timeout}s  |  chain={ChainKey}  [{UserId}]",
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
                        "[FILL ] Filled — orderIds={OrderIds}  |  chain={ChainKey}  [{UserId}]",
                        orderIds, chainKey, userId);
                    return;
                }
            }
            catch (InvalidOperationException) { throw; }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "[FILL ] Transient error polling — retrying  |  chain={ChainKey}  |  orderIds={OrderIds}  [{UserId}]",
                    chainKey, orderIds, userId);
            }

            await Task.Delay(500, ct);
        }

        logger.LogWarning(
            "[FILL ] Timeout after {Timeout}s — orderIds={OrderIds}  |  chain={ChainKey}  |  proceeding with open order  [{UserId}]",
            timeoutSeconds, orderIds, chainKey, userId);
    }
}
