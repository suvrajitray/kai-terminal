using KAITerminal.Api.Mapping;
using KAITerminal.Broker;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Zerodha.Services;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

/// <summary>
/// Per-connection coordinator for a SignalR client connected to <see cref="PositionsHub"/>.
/// Polls positions from all connected brokers every <see cref="PositionPollIntervalMs"/> ms,
/// pushes combined <c>ReceivePositions</c> to the frontend, and subscribes all open instruments
/// to the shared Upstox market-data feed for live LTP via <c>ReceiveLtpBatch</c>.
///
/// Supports any number of brokers symmetrically — Upstox and Zerodha are treated identically.
/// Zerodha instruments are mapped to Upstox feed tokens via exchange_token (public Kite CSV).
/// </summary>
internal sealed class PositionStreamCoordinator : IAsyncDisposable
{
    private readonly IHubContext<PositionsHub>    _hub;
    private readonly IReadOnlyList<IBrokerClient> _brokers;
    private readonly ISharedMarketDataService     _sharedMarketData;
    private readonly IZerodhaInstrumentService    _zerodhaInstruments;
    private readonly string                       _connectionId;
    private readonly HashSet<string>?             _exchangeFilter;
    private readonly ILogger                      _logger;

    private const int PositionPollIntervalMs = 10_000;

    private readonly CancellationTokenSource _cts = new();
    private Task _pollLoop = Task.CompletedTask;

    // Upstox: instrument token IS the feed token — use HashSet for O(1) lookup in feed handler
    private HashSet<string> _subscribedUpstoxTokens = [];
    // Zerodha: feed token (e.g. "NSE_FO|885247") → native instrument token (e.g. "15942914")
    private Dictionary<string, string> _zerodhaFeedToNative = new(StringComparer.Ordinal);

    // Order status tracking: (brokerType, orderId) → last known status
    private Dictionary<(string, string), string> _lastOrderStatuses = new();

    private readonly EventHandler<LtpUpdate> _feedHandler;

    public PositionStreamCoordinator(
        IHubContext<PositionsHub>    hub,
        IReadOnlyList<IBrokerClient> brokers,
        ISharedMarketDataService     sharedMarketData,
        IZerodhaInstrumentService    zerodhaInstruments,
        string                       connectionId,
        HashSet<string>?             exchangeFilter,
        ILogger                      logger)
    {
        _hub                = hub;
        _brokers            = brokers;
        _sharedMarketData   = sharedMarketData;
        _zerodhaInstruments = zerodhaInstruments;
        _connectionId       = connectionId;
        _exchangeFilter     = exchangeFilter;
        _logger             = logger;
        _feedHandler        = OnFeedReceived;
    }

    internal async Task StartAsync(CancellationToken ct = default)
    {
        var allPositions = await FetchAllPositionsAsync(ct);

        await RefreshSubscriptionsAsync(allPositions, ct);

        var filtered = ApplyFilter(allPositions);
        await _hub.Clients.Client(_connectionId)
            .SendAsync("ReceivePositions", filtered.Select(p => p.ToResponse()).ToList(), ct);

        _sharedMarketData.FeedReceived += _feedHandler;
        _pollLoop = RunPollLoopAsync(_cts.Token);
    }

    // ── Poll loop ─────────────────────────────────────────────────────────────

    private async Task RunPollLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(PositionPollIntervalMs, ct);

                var allPositions = await FetchAllPositionsAsync(ct);
                var filtered = ApplyFilter(allPositions);
                await _hub.Clients.Client(_connectionId)
                    .SendAsync("ReceivePositions", filtered.Select(p => p.ToResponse()).ToList(), ct);

                await RefreshSubscriptionsAsync(allPositions, ct);
                await PollOrdersAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in position poll loop for connection {ConnectionId}", _connectionId);
            }
        }
    }

    // ── Position fetch ────────────────────────────────────────────────────────

    private async Task<IReadOnlyList<KAITerminal.Contracts.Domain.Position>> FetchAllPositionsAsync(
        CancellationToken ct)
    {
        var tasks = _brokers.Select(async broker =>
        {
            using var _ = broker.UseToken();
            return await broker.GetAllPositionsAsync(ct);
        });
        var results = await Task.WhenAll(tasks);
        return results.SelectMany(x => x).ToList();
    }

    // ── Feed subscription management ──────────────────────────────────────────

    private async Task RefreshSubscriptionsAsync(
        IReadOnlyList<KAITerminal.Contracts.Domain.Position> allPositions, CancellationToken ct)
    {
        // Upstox: instrument token IS the feed token
        var newUpstoxTokens = allPositions
            .Where(p => (p.Broker ?? "").Equals("upstox", StringComparison.OrdinalIgnoreCase)
                     && p.IsOpen
                     && !string.IsNullOrEmpty(p.InstrumentToken))
            .Select(p => p.InstrumentToken!)
            .ToHashSet(StringComparer.Ordinal);

        var addedUpstox = newUpstoxTokens.Except(_subscribedUpstoxTokens).ToList();
        if (addedUpstox.Count > 0)
        {
            _logger.LogInformation(
                "PositionStreamCoordinator [{Id}]: subscribing {Count} new Upstox instrument(s) — {Tokens}",
                _connectionId, addedUpstox.Count, string.Join(", ", addedUpstox));
            await _sharedMarketData.SubscribeAsync(addedUpstox, FeedMode.Ltpc, ct);
        }
        _subscribedUpstoxTokens = newUpstoxTokens;

        // Zerodha: map native tokens → feed tokens via exchange_token
        var openZerodha = allPositions
            .Where(p => (p.Broker ?? "").Equals("zerodha", StringComparison.OrdinalIgnoreCase)
                     && p.IsOpen
                     && !string.IsNullOrEmpty(p.InstrumentToken))
            .ToList();

        if (openZerodha.Count > 0)
        {
            var newFeedMap = await BuildZerodhaFeedMapAsync(openZerodha, ct);
            var addedZerodha = newFeedMap.Keys.Except(_zerodhaFeedToNative.Keys).ToList();
            if (addedZerodha.Count > 0)
            {
                _logger.LogInformation(
                    "PositionStreamCoordinator [{Id}]: subscribing {Count} new Zerodha instrument(s) — {Tokens}",
                    _connectionId, addedZerodha.Count, string.Join(", ", addedZerodha));
                await _sharedMarketData.SubscribeAsync(addedZerodha, FeedMode.Ltpc, ct);
            }
            _zerodhaFeedToNative = newFeedMap;
        }

        if (addedUpstox.Count == 0 && openZerodha.Count == 0)
            _logger.LogInformation(
                "PositionStreamCoordinator [{Id}]: no open positions — no LTP subscriptions requested",
                _connectionId);
    }

    private async Task<Dictionary<string, string>> BuildZerodhaFeedMapAsync(
        IReadOnlyList<KAITerminal.Contracts.Domain.Position> zerodhaPositions, CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        try
        {
            var instruments = await _zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);
            var tokenLookup = instruments.ToDictionary(c => c.TradingSymbol, c => c.ExchangeToken);

            foreach (var pos in zerodhaPositions)
            {
                if (!tokenLookup.TryGetValue(pos.InstrumentToken, out var exchangeToken)) continue;
                var prefix = ExchangeToFeedPrefix(pos.Exchange);
                if (prefix is null) continue;
                map[$"{prefix}|{exchangeToken}"] = pos.InstrumentToken;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "PositionStreamCoordinator [{Id}]: failed to build Zerodha feed map — Zerodha LTP will not be live",
                _connectionId);
        }
        return map;
    }

    private static string? ExchangeToFeedPrefix(string exchange) =>
        exchange.ToUpperInvariant() switch
        {
            "NFO" => "NSE_FO",
            "BFO" => "BSE_FO",
            _ => null
        };

    // ── Order polling ─────────────────────────────────────────────────────────

    private async Task PollOrdersAsync(CancellationToken ct)
    {
        foreach (var broker in _brokers)
        {
            try
            {
                using var _ = broker.UseToken();
                var orders = await broker.GetAllOrdersAsync(ct);

                foreach (var order in orders)
                {
                    var key    = (broker.BrokerType, order.OrderId);
                    var status = order.Status;

                    if (!_lastOrderStatuses.TryGetValue(key, out var prev) || prev == status)
                    {
                        _lastOrderStatuses[key] = status;
                        continue;
                    }

                    _lastOrderStatuses[key] = status;

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
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "PositionStreamCoordinator [{Id}]: error polling orders for {Broker}",
                    _connectionId, broker.BrokerType);
            }
        }
    }

    // ── LTP feed handler ──────────────────────────────────────────────────────

    private void OnFeedReceived(object? sender, LtpUpdate update)
    {
        // Upstox: feed token == instrument token → push as-is
        // Zerodha: feed token (NSE_FO|885247) → push with native numeric token so frontend matches
        var relevant = new List<object>(capacity: update.Ltps.Count);
        foreach (var (feedToken, ltp) in update.Ltps)
        {
            if (_subscribedUpstoxTokens.Contains(feedToken))
                relevant.Add(new { instrumentToken = feedToken, ltp });
            else if (_zerodhaFeedToNative.TryGetValue(feedToken, out var native))
                relevant.Add(new { instrumentToken = native, ltp });
        }

        if (relevant.Count == 0) return;

        _logger.LogDebug(
            "PositionStreamCoordinator [{Id}]: pushing ReceiveLtpBatch — {Count} instrument(s)",
            _connectionId, relevant.Count);

        _ = _hub.Clients.Client(_connectionId).SendAsync("ReceiveLtpBatch", relevant);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

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
        _logger.LogInformation(
            "PositionStreamCoordinator [{Id}]: disposing — stopping poll loop and detaching from feed",
            _connectionId);
        _sharedMarketData.FeedReceived -= _feedHandler;
        _cts.Cancel();
        try { await _pollLoop; } catch { /* ignore */ }
        _cts.Dispose();
    }
}
