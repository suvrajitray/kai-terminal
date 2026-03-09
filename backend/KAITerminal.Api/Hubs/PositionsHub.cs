using KAITerminal.Api.Services;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Services;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

public sealed class PositionsHub : Hub
{
    private readonly UpstoxClient _upstox;
    private readonly PositionStreamManager _manager;
    private readonly IHubContext<PositionsHub> _hubContext;

    public PositionsHub(UpstoxClient upstox, PositionStreamManager manager, IHubContext<PositionsHub> hubContext)
    {
        _upstox = upstox;
        _manager = manager;
        _hubContext = hubContext;
    }

    public override async Task OnConnectedAsync()
    {
        var token = Context.GetHttpContext()?.Request.Query["upstoxToken"].ToString();
        if (string.IsNullOrWhiteSpace(token))
        {
            Context.Abort();
            return;
        }

        var connectionId = Context.ConnectionId;
        var hubContext = _hubContext;

        // Send initial positions
        IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> positions;
        using (UpstoxTokenContext.Use(token))
            positions = await _upstox.GetAllPositionsAsync();

        await Clients.Caller.SendAsync("ReceivePositions", positions);

        // Create streamers under the user's token (token is captured inside ConnectAsync)
        IPortfolioStreamer portfolioStreamer;
        IMarketDataStreamer marketDataStreamer;
        using (UpstoxTokenContext.Use(token))
        {
            portfolioStreamer = _upstox.CreatePortfolioStreamer();
            marketDataStreamer = _upstox.CreateMarketDataStreamer();
            await portfolioStreamer.ConnectAsync([UpdateType.Order, UpdateType.Position]);
            await marketDataStreamer.ConnectAsync();
        }

        // Subscribe market data for open positions
        var openTokens = positions
            .Where(p => p.Quantity != 0 && !string.IsNullOrEmpty(p.InstrumentToken))
            .Select(p => p.InstrumentToken)
            .ToList();

        if (openTokens.Count > 0)
            using (UpstoxTokenContext.Use(token))
                await marketDataStreamer.SubscribeAsync(openTokens, FeedMode.Ltpc);

        // Portfolio update → re-fetch positions and push to client
        portfolioStreamer.UpdateReceived += (_, update) =>
        {
            if (update.Type is not ("order_update" or "position_update")) return;
            _ = Task.Run(async () =>
            {
                try
                {
                    IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> fresh;
                    using (UpstoxTokenContext.Use(token))
                        fresh = await _upstox.GetAllPositionsAsync();

                    await hubContext.Clients.Client(connectionId).SendAsync("ReceivePositions", fresh);

                    // Re-subscribe market data for any new instruments
                    var freshTokens = fresh
                        .Where(p => p.Quantity != 0 && !string.IsNullOrEmpty(p.InstrumentToken))
                        .Select(p => p.InstrumentToken)
                        .ToList();

                    if (freshTokens.Count > 0)
                        using (UpstoxTokenContext.Use(token))
                            await marketDataStreamer.SubscribeAsync(freshTokens, FeedMode.Ltpc);
                }
                catch { /* connection closed or Upstox error */ }
            });
        };

        // Market data tick → push LTP batch to client
        marketDataStreamer.FeedReceived += (_, msg) =>
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    var updates = msg.Instruments
                        .Select(kvp => new
                        {
                            instrumentToken = kvp.Key,
                            ltp = kvp.Value.Ltpc?.Ltp ?? kvp.Value.Full?.Ltpc?.Ltp ?? kvp.Value.OptionGreeks?.Ltpc?.Ltp
                        })
                        .Where(x => x.ltp.HasValue)
                        .Select(x => new { x.instrumentToken, ltp = x.ltp!.Value })
                        .ToList();

                    if (updates.Count > 0)
                        await hubContext.Clients.Client(connectionId).SendAsync("ReceiveLtpBatch", updates);
                }
                catch { /* connection closed */ }
            });
        };

        _manager.Add(connectionId, portfolioStreamer, marketDataStreamer);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await _manager.RemoveAsync(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
