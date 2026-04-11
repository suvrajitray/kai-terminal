using System.Collections.Concurrent;
using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Services;

namespace KAITerminal.Api.Hubs;

/// <summary>
/// Manages Upstox LTP feed subscriptions for a single SignalR connection.
/// Upstox feed token == instrument token — no mapping needed.
/// </summary>
internal sealed class UpstoxFeedSubscriptionManager
{
    private readonly ISharedMarketDataService _sharedMarketData;
    private readonly string                   _connectionId;
    private readonly ILogger                  _logger;

    private readonly ConcurrentDictionary<string, bool> _subscribedTokens = new(StringComparer.Ordinal);

    public UpstoxFeedSubscriptionManager(
        ISharedMarketDataService sharedMarketData,
        string                   connectionId,
        ILogger                  logger)
    {
        _sharedMarketData = sharedMarketData;
        _connectionId     = connectionId;
        _logger           = logger;
    }

    /// <summary>
    /// Updates Upstox subscriptions to match the open positions in <paramref name="allPositions"/>.
    /// Adds new entries first then removes stale ones to minimise the window where a live token
    /// is absent from the set.
    /// </summary>
    /// <returns>The number of active subscriptions after refresh.</returns>
    public async Task<int> RefreshAsync(
        IReadOnlyList<BrokerPosition> allPositions, CancellationToken ct)
    {
        var newTokens = allPositions
            .Where(p => string.Equals(p.Broker ?? "", BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase)
                     && p.IsOpen
                     && !string.IsNullOrEmpty(p.InstrumentToken))
            .Select(p => p.InstrumentToken!)
            .ToHashSet(StringComparer.Ordinal);

        // Always re-subscribe all current tokens — not just new ones.
        // This ensures the Worker recovers subscriptions after a restart without
        // requiring a frontend reconnect (the Worker's _subscribed set resets on startup).
        if (newTokens.Count > 0)
        {
            var added = newTokens.Except(_subscribedTokens.Keys).ToList();
            if (added.Count > 0)
                _logger.LogInformation(
                    "PositionStreamCoordinator [{Id}]: {New} new Upstox instrument(s) — resubscribing all {Total}",
                    _connectionId, added.Count, newTokens.Count);
            await _sharedMarketData.SubscribeAsync(newTokens.ToList(), FeedMode.Ltpc, ct);
        }

        // Add new entries first — avoids a brief window where a live token is absent from the set
        foreach (var key in newTokens)
            _subscribedTokens.TryAdd(key, true);
        foreach (var key in _subscribedTokens.Keys.Except(newTokens).ToList())
            _subscribedTokens.TryRemove(key, out _);

        return _subscribedTokens.Count;
    }

    /// <summary>Returns true if the feed token is subscribed for this connection.</summary>
    public bool ContainsToken(string feedToken) => _subscribedTokens.ContainsKey(feedToken);
}
