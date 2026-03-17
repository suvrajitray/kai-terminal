using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Hubs;

/// <summary>
/// Manages the portfolio + market-data WebSocket streams for a single SignalR connection.
/// Created per-connection by <see cref="PositionsHub"/> and disposed on disconnect.
/// </summary>
internal sealed class PositionStreamCoordinator : IAsyncDisposable
{
    private readonly UpstoxClient _upstox;
    private readonly IHubContext<PositionsHub> _hubContext;
    private readonly ILogger _logger;
    private readonly string _connectionId;
    private readonly string _token;
    private readonly HashSet<string>? _exchangeFilter;

    private IPortfolioStreamer? _portfolio;
    private IMarketDataStreamer? _marketData;

    internal PositionStreamCoordinator(
        UpstoxClient upstox,
        IHubContext<PositionsHub> hubContext,
        ILogger logger,
        string connectionId,
        string token,
        HashSet<string>? exchangeFilter)
    {
        _upstox = upstox;
        _hubContext = hubContext;
        _logger = logger;
        _connectionId = connectionId;
        _token = token;
        _exchangeFilter = exchangeFilter;
    }

    internal async Task StartAsync(IReadOnlyList<Position> initialPositions, CancellationToken ct = default)
    {
        using (UpstoxTokenContext.Use(_token))
        {
            _portfolio = _upstox.CreatePortfolioStreamer();
            _marketData = _upstox.CreateMarketDataStreamer();
            await _portfolio.ConnectAsync([UpdateType.Order, UpdateType.Position], ct);
            await _marketData.ConnectAsync(ct);
        }

        var instrumentKeys = GetInstrumentKeys(initialPositions);
        if (instrumentKeys.Count > 0)
            using (UpstoxTokenContext.Use(_token))
                await _marketData.SubscribeAsync(instrumentKeys, FeedMode.Ltpc, ct);

        _portfolio.UpdateReceived += OnPortfolioUpdate;
        _marketData.FeedReceived += OnFeedReceived;
    }

    // ── Event handlers ─────────────────────────────────────────────────────

    private void OnPortfolioUpdate(object? sender, PortfolioStreamUpdate update)
    {
        if (update.Type is not ("order" or "position")) return;
        _ = Task.Run(() => HandlePortfolioUpdateAsync(update));
    }

    private async Task HandlePortfolioUpdateAsync(PortfolioStreamUpdate update)
    {
        try
        {
            IReadOnlyList<Position> fresh;
            using (UpstoxTokenContext.Use(_token))
                fresh = await _upstox.GetAllPositionsAsync();

            fresh = ApplyFilter(fresh);
            await _hubContext.Clients.Client(_connectionId).SendAsync("ReceivePositions", fresh);

            if (update.Type == "order")
            {
                _logger.LogInformation(
                    "Sending ReceiveOrderUpdate: orderId={OrderId} status={Status} symbol={Symbol}",
                    update.OrderId, update.Status, update.TradingSymbol);
                await _hubContext.Clients.Client(_connectionId).SendAsync("ReceiveOrderUpdate", new
                {
                    orderId       = update.OrderId,
                    status        = update.Status,
                    statusMessage = update.StatusMessage,
                    tradingSymbol = update.TradingSymbol,
                });
            }

            var freshKeys = GetInstrumentKeys(fresh);
            if (freshKeys.Count > 0)
                using (UpstoxTokenContext.Use(_token))
                    await _marketData!.SubscribeAsync(freshKeys, FeedMode.Ltpc);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing portfolio update");
        }
    }

    private void OnFeedReceived(object? sender, MarketDataMessage msg)
    {
        _ = Task.Run(() => HandleFeedAsync(msg));
    }

    private async Task HandleFeedAsync(MarketDataMessage msg)
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
                await _hubContext.Clients.Client(_connectionId).SendAsync("ReceiveLtpBatch", updates);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex,
                "LTP push failed for connection {ConnectionId} — client likely disconnected", _connectionId);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static IReadOnlyList<string> GetInstrumentKeys(IReadOnlyList<Position> positions)
        => positions
            .Where(p => !string.IsNullOrEmpty(p.InstrumentToken))
            .Select(p => p.InstrumentToken)
            .Distinct()
            .ToList();

    private IReadOnlyList<Position> ApplyFilter(IReadOnlyList<Position> positions)
    {
        if (_exchangeFilter is null) return positions;
        return positions
            .Where(p => _exchangeFilter.Contains(p.Exchange.ToUpperInvariant()))
            .ToList()
            .AsReadOnly();
    }

    // ── Dispose ────────────────────────────────────────────────────────────

    public async ValueTask DisposeAsync()
    {
        if (_portfolio is not null)
        {
            _portfolio.UpdateReceived -= OnPortfolioUpdate;
            await _portfolio.DisposeAsync();
        }

        if (_marketData is not null)
        {
            _marketData.FeedReceived -= OnFeedReceived;
            await _marketData.DisposeAsync();
        }
    }
}
