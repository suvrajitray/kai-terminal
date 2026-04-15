using KAITerminal.Api.Hubs;

namespace KAITerminal.Api.Services;

/// <summary>
/// Pushes broker order updates to all active SignalR connections for a user
/// and optionally triggers an immediate position refresh.
/// Shared by all broker webhook handlers.
/// </summary>
internal sealed class WebhookOrderProcessor(PositionStreamManager manager)
{
    /// <summary>
    /// Returns true when the order status warrants pushing to the frontend.
    /// Only "complete" and "rejected" statuses trigger client notifications.
    /// </summary>
    public bool IsActionableStatus(string? rawStatus) =>
        rawStatus?.ToLowerInvariant() is "complete" or "rejected";

    /// <summary>
    /// Pushes the order update to all active connections for <paramref name="username"/>
    /// and optionally triggers a position refresh when <paramref name="refresh"/> is true.
    /// </summary>
    public async Task ProcessAsync(
        string username, string broker,
        string orderId, string status, string statusMessage,
        string tradingSymbol, decimal averagePrice, string transactionType, int filledQuantity,
        bool refresh, ILogger logger)
    {
        var coordinators = manager.GetAllForUser(username).ToList();
        logger.LogDebug(
            "{Broker} webhook: pushing to {Count} active connection(s) for user={User}",
            broker, coordinators.Count, username);

        var tasks = coordinators.Select(async coord =>
        {
            logger.LogDebug(
                "{Broker} webhook: sending ReceiveOrderUpdate to connection={Connection} — orderId={OrderId} status={Status}",
                broker, coord.Username, orderId, status);
            await coord.PushOrderUpdateAsync(orderId, status, statusMessage, tradingSymbol, averagePrice, transactionType, filledQuantity);
            if (refresh)
            {
                logger.LogDebug(
                    "{Broker} webhook: triggering position refresh for connection={Connection}",
                    broker, coord.Username);
                await coord.TriggerRefreshAsync();
            }
        });
        await Task.WhenAll(tasks);
    }
}
