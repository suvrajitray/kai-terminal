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
    private readonly ILogger<PositionsHub> _logger;

    public PositionsHub(UpstoxClient upstox, PositionStreamManager manager, IHubContext<PositionsHub> hubContext, ILogger<PositionsHub> logger)
    {
        _upstox = upstox;
        _manager = manager;
        _hubContext = hubContext;
        _logger = logger;
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

        // Optional comma-separated exchange filter, e.g. "NFO,BFO"
        var exchangeFilter = ParseExchanges(qs?["exchange"].ToString());

        var connectionId = Context.ConnectionId;
        var hubContext = _hubContext;

        // Send initial positions
        IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> positions;
        using (UpstoxTokenContext.Use(token))
            positions = await _upstox.GetAllPositionsAsync();

        positions = Filter(positions, exchangeFilter);
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

        // Subscribe market data for all positions (open + closed)
        var allTokens = positions
            .Where(p => !string.IsNullOrEmpty(p.InstrumentToken))
            .Select(p => p.InstrumentToken)
            .Distinct()
            .ToList();

        if (allTokens.Count > 0)
            using (UpstoxTokenContext.Use(token))
                await marketDataStreamer.SubscribeAsync(allTokens, FeedMode.Ltpc);

        // Portfolio update → re-fetch positions and push to client
        portfolioStreamer.UpdateReceived += (_, update) =>
        {
            if (update.Type is not ("order" or "position")) return;
            var logger = _logger;
            _ = Task.Run(async () =>
            {
                try
                {
                    IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> fresh;
                    using (UpstoxTokenContext.Use(token))
                        fresh = await _upstox.GetAllPositionsAsync();

                    fresh = Filter(fresh, exchangeFilter);
                    await hubContext.Clients.Client(connectionId).SendAsync("ReceivePositions", fresh);

                    if (update.Type == "order")
                    {
                        logger.LogInformation("Sending ReceiveOrderUpdate: orderId={OrderId} status={Status} symbol={Symbol}",
                            update.OrderId, update.Status, update.TradingSymbol);
                        await hubContext.Clients.Client(connectionId).SendAsync("ReceiveOrderUpdate", new
                        {
                            orderId       = update.OrderId,
                            status        = update.Status,
                            statusMessage = update.StatusMessage,
                            tradingSymbol = update.TradingSymbol,
                        });
                    }

                    // Re-subscribe market data for all instruments (open + closed)
                    var freshTokens = fresh
                        .Where(p => !string.IsNullOrEmpty(p.InstrumentToken))
                        .Select(p => p.InstrumentToken)
                        .Distinct()
                        .ToList();

                    if (freshTokens.Count > 0)
                        using (UpstoxTokenContext.Use(token))
                            await marketDataStreamer.SubscribeAsync(freshTokens, FeedMode.Ltpc);
                }
                catch (Exception ex) { logger.LogError(ex, "Error processing portfolio update"); }
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
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "LTP push failed for connection {ConnectionId} — client likely disconnected", connectionId);
                }
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

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static HashSet<string>? ParseExchanges(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var set = raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToUpperInvariant())
            .ToHashSet();
        return set.Count > 0 ? set : null;
    }

    private static IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> Filter(
        IReadOnlyList<KAITerminal.Upstox.Models.Responses.Position> positions,
        HashSet<string>? exchanges)
    {
        if (exchanges is null) return positions;
        return positions
            .Where(p => exchanges.Contains(p.Exchange.ToUpperInvariant()))
            .ToList()
            .AsReadOnly();
    }
}
