using KAITerminal.Api.Services;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Infrastructure.Services;
using KAITerminal.MarketData.Services;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

public sealed class IndexHub : Hub
{
    private static readonly IReadOnlyList<string> IndexTokens =
    [
        "NSE_INDEX|Nifty 50",
        "NSE_INDEX|Nifty Bank",
        "BSE_INDEX|SENSEX",
        "NSE_INDEX|Nifty Fin Service",
        "BSE_INDEX|BANKEX",
    ];

    private static readonly HashSet<string> IndexTokenSet =
        IndexTokens.ToHashSet(StringComparer.Ordinal);

    private readonly IMarketQuoteService      _quotes;
    private readonly ISharedMarketDataService _sharedMarketData;
    private readonly IndexStreamManager       _manager;
    private readonly IHubContext<IndexHub>    _hubContext;
    private readonly ILogger<IndexHub>        _logger;

    public IndexHub(
        IMarketQuoteService      quotes,
        ISharedMarketDataService sharedMarketData,
        IndexStreamManager       manager,
        IHubContext<IndexHub>    hubContext,
        ILogger<IndexHub>        logger)
    {
        _quotes           = quotes;
        _sharedMarketData = sharedMarketData;
        _manager          = manager;
        _hubContext       = hubContext;
        _logger           = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var connectionId = Context.ConnectionId;
        var ct           = Context.ConnectionAborted;

        // One-time REST call — gives accurate OHLC + netChange for the initial snapshot.
        // IMarketQuoteService uses the admin analytics token internally so no user token needed.
        try
        {
            var quotes = await _quotes.GetMarketQuotesAsync(IndexTokens, ct);
            var normalised = quotes.ToDictionary(kv => kv.Key.Replace(':', '|'), kv => kv.Value);
            var snapshot = IndexTokens
                .Where(normalised.ContainsKey)
                .Select(t => new
                {
                    instrumentToken = t,
                    ltp       = normalised[t].LastPrice,
                    open      = normalised[t].Ohlc?.Open,
                    high      = normalised[t].Ohlc?.High,
                    low       = normalised[t].Ohlc?.Low,
                    netChange = normalised[t].NetChange,
                })
                .ToList();

            if (snapshot.Count > 0)
            {
                await Clients.Caller.SendAsync("ReceiveIndexSnapshot", snapshot, ct);
                _logger.LogInformation(
                    "IndexHub [{Id}]: initial snapshot sent — {Count} index/indices",
                    connectionId, snapshot.Count);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "IndexHub [{Id}]: failed to fetch initial snapshot — analytics token may not be configured", connectionId);
        }

        // Subscribe index tokens to the shared feed (idempotent across connections)
        await _sharedMarketData.SubscribeAsync(IndexTokens.ToList(), FeedMode.Ltpc, ct);
        _logger.LogInformation(
            "IndexHub [{Id}]: subscribed {Count} index token(s) to shared feed", connectionId, IndexTokens.Count);

        // Per-connection feed handler — pushes LTP ticks to this client only
        EventHandler<LtpUpdate> handler = (_, update) => OnFeedReceived(connectionId, update);
        _sharedMarketData.FeedReceived += handler;
        _manager.Add(connectionId, handler);

        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        var handler = _manager.Remove(Context.ConnectionId);
        if (handler is not null)
            _sharedMarketData.FeedReceived -= handler;
        return base.OnDisconnectedAsync(exception);
    }

    private void OnFeedReceived(string connectionId, LtpUpdate update)
    {
        var relevant = update.Ltps
            .Where(kv => IndexTokenSet.Contains(kv.Key))
            .Select(kv => new { instrumentToken = kv.Key, ltp = kv.Value })
            .ToList();

        if (relevant.Count == 0) return;

        _ = _hubContext.Clients.Client(connectionId).SendAsync("ReceiveIndexBatch", relevant);
    }
}
