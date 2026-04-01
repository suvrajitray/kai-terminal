using KAITerminal.Api.Services;
using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Services;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

/// <summary>
/// SignalR hub for live option chain LTP streaming.
/// Clients subscribe instrument feed tokens; matching LTP ticks are pushed via <c>ReceiveLtpBatch</c>.
/// No broker auth required — all data comes from the shared Upstox market-data feed.
/// </summary>
public sealed class OptionChainHub : Hub
{
    private readonly ISharedMarketDataService  _sharedMarketData;
    private readonly OptionChainStreamManager  _manager;
    private readonly IHubContext<OptionChainHub> _hubContext;
    private readonly ILogger<OptionChainHub>   _logger;

    public OptionChainHub(
        ISharedMarketDataService    sharedMarketData,
        OptionChainStreamManager    manager,
        IHubContext<OptionChainHub> hubContext,
        ILogger<OptionChainHub>     logger)
    {
        _sharedMarketData = sharedMarketData;
        _manager          = manager;
        _hubContext       = hubContext;
        _logger           = logger;
    }

    // ── Client-invokable methods ──────────────────────────────────────────

    /// <summary>Subscribe to live LTP updates for the given feed tokens (e.g. option chain live window).</summary>
    public async Task SubscribeToInstruments(IReadOnlyList<string> feedTokens)
    {
        var coordinator = _manager.GetCoordinator(Context.ConnectionId);
        if (coordinator is not null)
            await coordinator.SubscribeAsync(feedTokens, Context.ConnectionAborted);
    }

    /// <summary>Clear all subscriptions for this connection (e.g. when changing underlying/expiry).</summary>
    public Task ClearSubscriptions()
    {
        _manager.GetCoordinator(Context.ConnectionId)?.ClearSubscriptions();
        return Task.CompletedTask;
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────

    public override Task OnConnectedAsync()
    {
        var connectionId = Context.ConnectionId;
        var coordinator  = new OptionChainCoordinator(_hubContext, _sharedMarketData, connectionId, _logger);
        _manager.Add(connectionId, coordinator);
        _logger.LogInformation("OptionChainHub: client {Id} connected", connectionId);
        return base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception is null)
            _logger.LogInformation("OptionChainHub: client {Id} disconnected", Context.ConnectionId);
        else
            _logger.LogWarning(exception, "OptionChainHub: client {Id} disconnected with error", Context.ConnectionId);

        await _manager.RemoveAsync(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
