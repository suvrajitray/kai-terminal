using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Services;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

/// <summary>
/// Per-connection coordinator for <see cref="OptionChainHub"/>.
/// Tracks the client's subscribed feed tokens and forwards matching LTP ticks
/// via <c>ReceiveLtpBatch</c>.
/// </summary>
internal sealed class OptionChainCoordinator : IAsyncDisposable
{
    private readonly IHubContext<OptionChainHub>    _hub;
    private readonly ISharedMarketDataService       _sharedMarketData;
    private readonly string                          _connectionId;
    private readonly ILogger                         _logger;

    private readonly HashSet<string>            _subscribedTokens = [];
    private readonly EventHandler<LtpUpdate>    _feedHandler;

    public OptionChainCoordinator(
        IHubContext<OptionChainHub> hub,
        ISharedMarketDataService    sharedMarketData,
        string                      connectionId,
        ILogger                     logger)
    {
        _hub              = hub;
        _sharedMarketData = sharedMarketData;
        _connectionId     = connectionId;
        _logger           = logger;
        _feedHandler      = OnFeedReceived;

        _sharedMarketData.FeedReceived += _feedHandler;
    }

    public async Task SubscribeAsync(IReadOnlyList<string> feedTokens, CancellationToken ct = default)
    {
        _subscribedTokens.UnionWith(feedTokens);
        await _sharedMarketData.SubscribeAsync(feedTokens, FeedMode.Ltpc, ct);
        _logger.LogDebug(
            "OptionChainCoordinator [{Id}]: subscribed {Count} token(s) — total tracked: {Total}",
            _connectionId, feedTokens.Count, _subscribedTokens.Count);
    }

    public void ClearSubscriptions()
    {
        _subscribedTokens.Clear();
        _logger.LogDebug("OptionChainCoordinator [{Id}]: cleared all subscriptions", _connectionId);
    }

    private void OnFeedReceived(object? sender, LtpUpdate update)
    {
        var relevant = new List<object>(capacity: update.Ltps.Count);
        foreach (var (feedToken, ltp) in update.Ltps)
        {
            if (_subscribedTokens.Contains(feedToken))
                relevant.Add(new { instrumentToken = feedToken, ltp });
        }

        if (relevant.Count == 0) return;

        _ = _hub.Clients.Client(_connectionId).SendAsync("ReceiveLtpBatch", relevant);
    }

    public ValueTask DisposeAsync()
    {
        _sharedMarketData.FeedReceived -= _feedHandler;
        _logger.LogInformation(
            "OptionChainCoordinator [{Id}]: disposed — detached from feed", _connectionId);
        return ValueTask.CompletedTask;
    }
}
