using KAITerminal.Api.Services;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Services;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

public sealed class IndexHub : Hub
{
    private static readonly List<string> IndexTokens =
    [
        "NSE_INDEX|Nifty 50",
        "NSE_INDEX|Nifty Bank",
        "BSE_INDEX|SENSEX",
    ];

    private readonly UpstoxClient _upstox;
    private readonly IndexStreamManager _manager;
    private readonly IHubContext<IndexHub> _hubContext;

    public IndexHub(UpstoxClient upstox, IndexStreamManager manager, IHubContext<IndexHub> hubContext)
    {
        _upstox = upstox;
        _manager = manager;
        _hubContext = hubContext;
    }

    public override async Task OnConnectedAsync()
    {
        var qs = Context.GetHttpContext()?.Request.Query;
        var token = qs?["upstoxToken"].ToString();
        if (string.IsNullOrWhiteSpace(token))
        {
            Context.Abort();
            return;
        }

        var connectionId = Context.ConnectionId;
        var hubContext = _hubContext;

        IMarketDataStreamer marketDataStreamer;
        using (UpstoxTokenContext.Use(token))
        {
            marketDataStreamer = _upstox.CreateMarketDataStreamer();
            await marketDataStreamer.ConnectAsync();
        }

        // Fetch initial Open/High/LTP from REST API and send snapshot
        try
        {
            IReadOnlyDictionary<string, KAITerminal.Upstox.Models.Responses.MarketQuote> quotes;
            using (UpstoxTokenContext.Use(token))
                quotes = await _upstox.GetMarketQuotesAsync(IndexTokens);

            // Upstox quotes API returns keys with ':' separator (e.g. "NSE_INDEX:Nifty 50")
            // but instrument tokens use '|' (e.g. "NSE_INDEX|Nifty 50") — normalise before lookup
            var normalised = quotes.ToDictionary(kv => kv.Key.Replace(':', '|'), kv => kv.Value);

            var snapshot = IndexTokens
                .Where(normalised.ContainsKey)
                .Select(t => new
                {
                    instrumentToken = t,
                    ltp  = normalised[t].LastPrice,
                    open = normalised[t].Ohlc?.Open,
                    high = normalised[t].Ohlc?.High,
                })
                .ToList();

            if (snapshot.Count > 0)
                await Clients.Caller.SendAsync("ReceiveIndexSnapshot", snapshot);
        }
        catch { /* market closed or API error — snapshot is optional */ }

        using (UpstoxTokenContext.Use(token))
            await marketDataStreamer.SubscribeAsync(IndexTokens, FeedMode.Ltpc);

        marketDataStreamer.FeedReceived += (_, msg) =>
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    var updates = msg.Instruments
                        .Select(kvp =>
                        {
                            var ltp = kvp.Value.Ltpc?.Ltp ?? kvp.Value.Full?.Ltpc?.Ltp;
                            return ltp.HasValue
                                ? new { instrumentToken = kvp.Key, ltp = ltp.Value }
                                : null;
                        })
                        .Where(x => x is not null)
                        .ToList();

                    if (updates.Count > 0)
                        await hubContext.Clients.Client(connectionId).SendAsync("ReceiveIndexBatch", updates);
                }
                catch { /* connection closed */ }
            });
        };

        _manager.Add(connectionId, marketDataStreamer);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await _manager.RemoveAsync(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
