using KAITerminal.Api.Mapping;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Responses;
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
            await _portfolio.ConnectAsync(ct);
            await _marketData.ConnectAsync(ct);
        }

        var instrumentKeys = GetInstrumentKeys(initialPositions);
        if (instrumentKeys.Count > 0)
            using (UpstoxTokenContext.Use(_token))
                await _marketData.SubscribeAsync(instrumentKeys, FeedMode.Ltpc);

        _portfolio.UpdateReceived += OnPortfolioUpdate;
        _marketData.FeedReceived += OnFeedReceived;
    }

    // ── Event handlers ─────────────────────────────────────────────────────

    private void OnPortfolioUpdate(object? sender, PortfolioUpdate update)
    {
        if (update.UpdateType is not ("order" or "position")) return;
        _ = Task.Run(() => HandlePortfolioUpdateAsync(update));
    }

    private async Task HandlePortfolioUpdateAsync(PortfolioUpdate update)
    {
        try
        {
            IReadOnlyList<Position> fresh;
            using (UpstoxTokenContext.Use(_token))
                fresh = await _upstox.GetAllPositionsAsync();

            fresh = ApplyFilter(fresh);
            await _hubContext.Clients.Client(_connectionId)
                .SendAsync("ReceivePositions", fresh.Select(p => p.ToResponse()).ToList());

            if (update.UpdateType == "order")
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

    private void OnFeedReceived(object? sender, LtpUpdate update)
    {
        _ = Task.Run(() => HandleFeedAsync(update));
    }

    private async Task HandleFeedAsync(LtpUpdate update)
    {
        try
        {
            var updates = update.Ltps
                .Select(kvp => new { instrumentToken = kvp.Key, ltp = kvp.Value })
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
