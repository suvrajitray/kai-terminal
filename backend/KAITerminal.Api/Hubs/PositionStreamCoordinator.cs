using KAITerminal.Api.Mapping;
using KAITerminal.Broker;
using KAITerminal.Contracts.Streaming;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

/// <summary>
/// Per-connection coordinator for a SignalR client connected to <see cref="PositionsHub"/>.
/// Subscribes to <see cref="ISharedMarketDataService"/> for LTP ticks and polls positions
/// via REST every <see cref="PositionPollIntervalMs"/> milliseconds.
/// Replaces the previous design that opened per-user broker WebSocket streams.
/// </summary>
internal sealed class PositionStreamCoordinator : IAsyncDisposable
{
    private readonly IHubContext<PositionsHub> _hub;
    private readonly IBrokerClient             _broker;
    private readonly ISharedMarketDataService  _sharedMarketData;
    private readonly string                    _connectionId;
    private readonly HashSet<string>?          _exchangeFilter;
    private readonly ILogger                   _logger;

    private const int PositionPollIntervalMs = 10_000;

    private readonly CancellationTokenSource _cts = new();
    private Task _pollLoop = Task.CompletedTask;

    // Tracks instruments this coordinator has subscribed to
    private List<string> _subscribedTokens = [];

    // Last known order statuses for change detection
    private Dictionary<string, string> _lastOrderStatuses = new(StringComparer.Ordinal);

    private readonly EventHandler<LtpUpdate> _feedHandler;

    public PositionStreamCoordinator(
        IHubContext<PositionsHub> hub,
        IBrokerClient             broker,
        ISharedMarketDataService  sharedMarketData,
        string                    connectionId,
        HashSet<string>?          exchangeFilter,
        ILogger                   logger)
    {
        _hub              = hub;
        _broker           = broker;
        _sharedMarketData = sharedMarketData;
        _connectionId     = connectionId;
        _exchangeFilter   = exchangeFilter;
        _logger           = logger;
        _feedHandler      = OnFeedReceived;
    }

    internal async Task StartAsync(IReadOnlyList<KAITerminal.Contracts.Domain.Position> initialPositions, CancellationToken ct = default)
    {
        _subscribedTokens = initialPositions
            .Where(p => p.IsOpen && !string.IsNullOrEmpty(p.InstrumentToken))
            .Select(p => p.InstrumentToken)
            .ToList();

        if (_subscribedTokens.Count > 0)
        {
            _logger.LogInformation(
                "PositionStreamCoordinator [{Id}]: requesting LTP subscription for {Count} open instrument(s) — {Tokens}",
                _connectionId, _subscribedTokens.Count, string.Join(", ", _subscribedTokens));
            await _sharedMarketData.SubscribeAsync(_subscribedTokens, FeedMode.Ltpc, _cts.Token);
        }
        else
        {
            _logger.LogInformation(
                "PositionStreamCoordinator [{Id}]: no open positions — no LTP subscriptions requested", _connectionId);
        }

        _sharedMarketData.FeedReceived += _feedHandler;

        // Start position poll loop
        _pollLoop = RunPollLoopAsync(_cts.Token);
    }

    private async Task RunPollLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(PositionPollIntervalMs, ct);

                // Fetch fresh positions
                using var _ = _broker.UseToken();
                var allPositions = await _broker.GetAllPositionsAsync(ct);
                var filtered = ApplyFilter(allPositions);
                await _hub.Clients.Client(_connectionId)
                    .SendAsync("ReceivePositions", filtered.Select(p => p.ToResponse()).ToList(), ct);

                // Poll orders and push ReceiveOrderUpdate on status transitions
                await PollOrdersAsync(ct);

                // Update subscriptions based on current open instruments
                var currentTokens = allPositions
                    .Where(p => p.IsOpen && !string.IsNullOrEmpty(p.InstrumentToken))
                    .Select(p => p.InstrumentToken)
                    .ToList();

                var added = currentTokens.Except(_subscribedTokens).ToList();
                // Note: don't unsubscribe removed — other users may still need them

                if (added.Count > 0)
                {
                    _logger.LogInformation(
                        "PositionStreamCoordinator [{Id}]: new open instrument(s) detected — subscribing {Count} additional token(s): {Tokens}",
                        _connectionId, added.Count, string.Join(", ", added));
                    await _sharedMarketData.SubscribeAsync(added, FeedMode.Ltpc, ct);
                }

                _subscribedTokens = currentTokens;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in position poll loop for connection {ConnectionId}", _connectionId);
            }
        }
    }

    private async Task PollOrdersAsync(CancellationToken ct)
    {
        var orders = await _broker.GetAllOrdersAsync(ct);
        foreach (var order in orders)
        {
            var status = order.Status;
            if (!_lastOrderStatuses.TryGetValue(order.OrderId, out var prev) || prev == status)
            {
                _lastOrderStatuses[order.OrderId] = status;
                continue;
            }

            _lastOrderStatuses[order.OrderId] = status;

            // Only notify on terminal transitions the user cares about
            if (!status.Equals("complete", StringComparison.OrdinalIgnoreCase) &&
                !status.Equals("rejected", StringComparison.OrdinalIgnoreCase))
                continue;

            await _hub.Clients.Client(_connectionId).SendAsync("ReceiveOrderUpdate", new
            {
                orderId       = order.OrderId,
                status        = order.Status,
                statusMessage = order.StatusMessage,
                tradingSymbol = order.TradingSymbol,
            }, ct);
        }
    }

    private void OnFeedReceived(object? sender, LtpUpdate update)
    {
        // Filter to only this connection's open instruments
        var relevant = update.Ltps
            .Where(kv => _subscribedTokens.Contains(kv.Key))
            .Select(kv => new { instrumentToken = kv.Key, ltp = kv.Value })
            .ToList();

        if (relevant.Count == 0) return;

        _logger.LogDebug(
            "PositionStreamCoordinator [{Id}]: pushing ReceiveLtpBatch — {Count} instrument(s)",
            _connectionId, relevant.Count);

        _ = _hub.Clients.Client(_connectionId)
            .SendAsync("ReceiveLtpBatch", relevant);
    }

    private IReadOnlyList<KAITerminal.Contracts.Domain.Position> ApplyFilter(
        IReadOnlyList<KAITerminal.Contracts.Domain.Position> positions)
    {
        if (_exchangeFilter is null) return positions;
        return positions
            .Where(p => _exchangeFilter.Contains(p.Exchange.ToUpperInvariant()))
            .ToList()
            .AsReadOnly();
    }

    public async ValueTask DisposeAsync()
    {
        _logger.LogInformation("PositionStreamCoordinator [{Id}]: disposing — stopping poll loop and detaching from feed", _connectionId);
        _sharedMarketData.FeedReceived -= _feedHandler;
        _cts.Cancel();
        try { await _pollLoop; } catch { /* ignore */ }
        _cts.Dispose();
    }
}
