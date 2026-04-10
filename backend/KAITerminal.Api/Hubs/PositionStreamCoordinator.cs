using System.Collections.Concurrent;
using KAITerminal.Api.Mapping;
using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Services;
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
public sealed class PositionStreamCoordinator : IAsyncDisposable
{
    private readonly IHubContext<PositionsHub>    _hub;
    private readonly IReadOnlyList<IBrokerClient> _brokers;
    private readonly ISharedMarketDataService     _sharedMarketData;
    private readonly IZerodhaInstrumentService    _zerodhaInstruments;
    private readonly string                       _connectionId;
    private readonly HashSet<string>?             _exchangeFilter;
    private readonly ILogger                      _logger;

    private const int PositionPollIntervalMs = 10_000;

    public string Username { get; }
    public bool HasBroker(string brokerType) =>
        _brokers.Any(b => b.BrokerType.Equals(brokerType, StringComparison.OrdinalIgnoreCase));

    private readonly CancellationTokenSource _cts = new();
    private Task _pollLoop = Task.CompletedTask;

    // Upstox: instrument token IS the feed token — ConcurrentDictionary for thread-safe O(1) lookup in feed handler
    private readonly ConcurrentDictionary<string, bool> _subscribedUpstoxTokens = new(StringComparer.Ordinal);
    // Zerodha: feed token (e.g. "NSE_FO|885247") → native instrument token (e.g. "15942914")
    private readonly ConcurrentDictionary<string, string> _zerodhaFeedToNative = new(StringComparer.Ordinal);

    private readonly EventHandler<LtpUpdate> _feedHandler;

    public PositionStreamCoordinator(
        IHubContext<PositionsHub>    hub,
        IReadOnlyList<IBrokerClient> brokers,
        ISharedMarketDataService     sharedMarketData,
        IZerodhaInstrumentService    zerodhaInstruments,
        string                       connectionId,
        string                       username,
        HashSet<string>?             exchangeFilter,
        ILogger                      logger)
    {
        _hub                = hub;
        _brokers            = brokers;
        _sharedMarketData   = sharedMarketData;
        _zerodhaInstruments = zerodhaInstruments;
        _connectionId       = connectionId;
        Username            = username;
        _exchangeFilter     = exchangeFilter;
        _logger             = logger;
        _feedHandler        = OnFeedReceived;
    }

    internal async Task StartAsync(CancellationToken ct = default)
    {
        var allPositions = await FetchAllPositionsAsync(ct);
        var filtered = ApplyFilter(allPositions);

        await RefreshSubscriptionsAsync(filtered, ct);

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

                await RefreshSubscriptionsAsync(filtered, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PositionStreamCoordinator [{Id}]: error in poll loop — will retry", _connectionId);
            }
        }
    }

    // ── Position fetch ────────────────────────────────────────────────────────

    private async Task<IReadOnlyList<KAITerminal.Contracts.Domain.BrokerPosition>> FetchAllPositionsAsync(
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
        IReadOnlyList<KAITerminal.Contracts.Domain.BrokerPosition> allPositions, CancellationToken ct)
    {
        // Upstox: instrument token IS the feed token
        var newUpstoxTokens = allPositions
            .Where(p => string.Equals(p.Broker ?? "", BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase)
                     && p.IsOpen
                     && !string.IsNullOrEmpty(p.InstrumentToken))
            .Select(p => p.InstrumentToken!)
            .ToHashSet(StringComparer.Ordinal);

        // Always re-subscribe all current tokens — not just new ones.
        // This ensures the Worker recovers subscriptions after a restart without
        // requiring a frontend reconnect (the Worker's _subscribed set resets on startup).
        if (newUpstoxTokens.Count > 0)
        {
            var addedUpstox = newUpstoxTokens.Except(_subscribedUpstoxTokens.Keys).ToList();
            if (addedUpstox.Count > 0)
                _logger.LogInformation(
                    "PositionStreamCoordinator [{Id}]: {New} new Upstox instrument(s) — resubscribing all {Total}",
                    _connectionId, addedUpstox.Count, newUpstoxTokens.Count);
            await _sharedMarketData.SubscribeAsync(newUpstoxTokens.ToList(), FeedMode.Ltpc, ct);
        }
        // Add new entries first — avoids a brief window where a live token is absent from the map
        foreach (var key in newUpstoxTokens)
            _subscribedUpstoxTokens.TryAdd(key, true);
        foreach (var key in _subscribedUpstoxTokens.Keys.Except(newUpstoxTokens).ToList())
            _subscribedUpstoxTokens.TryRemove(key, out _);

        // Zerodha: map native tokens → feed tokens via exchange_token
        var openZerodha = allPositions
            .Where(p => string.Equals(p.Broker ?? "", BrokerNames.Zerodha, StringComparison.OrdinalIgnoreCase)
                     && p.IsOpen
                     && !string.IsNullOrEmpty(p.InstrumentToken))
            .ToList();

        if (openZerodha.Count > 0)
        {
            var newFeedMap = await BuildZerodhaFeedMapAsync(openZerodha, ct);
            if (newFeedMap.Count > 0)
            {
                var addedZerodha = newFeedMap.Keys.Except(_zerodhaFeedToNative.Keys).ToList();
                if (addedZerodha.Count > 0)
                    _logger.LogInformation(
                        "PositionStreamCoordinator [{Id}]: {New} new Zerodha instrument(s) — resubscribing all {Total}",
                        _connectionId, addedZerodha.Count, newFeedMap.Count);
                await _sharedMarketData.SubscribeAsync(newFeedMap.Keys.ToList(), FeedMode.Ltpc, ct);
            }
            // Add new entries first — avoids a brief window where a live token is absent
            foreach (var (k, v) in newFeedMap)
                _zerodhaFeedToNative[k] = v;
            foreach (var key in _zerodhaFeedToNative.Keys.Except(newFeedMap.Keys).ToList())
                _zerodhaFeedToNative.TryRemove(key, out _);
        }
        else
        {
            // No open Zerodha positions — clear stale mappings so OnFeedReceived doesn't route phantom ticks
            _zerodhaFeedToNative.Clear();
        }

        if (newUpstoxTokens.Count == 0 && openZerodha.Count == 0)
            _logger.LogInformation(
                "PositionStreamCoordinator [{Id}]: no open positions — no LTP subscriptions requested",
                _connectionId);
    }

    private async Task<Dictionary<string, string>> BuildZerodhaFeedMapAsync(
        IReadOnlyList<KAITerminal.Contracts.Domain.BrokerPosition> zerodhaPositions, CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        try
        {
            var instruments = await _zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);
            var tokenLookup = instruments.ToDictionary(c => c.TradingSymbol, c => c.ExchangeToken);

            foreach (var pos in zerodhaPositions)
            {
                if (!tokenLookup.TryGetValue(pos.InstrumentToken, out var exchangeToken))
                {
                    _logger.LogWarning(
                        "PositionStreamCoordinator [{Id}]: no CSV match for Zerodha token '{Token}' (exchange={Exchange}) — live LTP will not update for this position",
                        _connectionId, pos.InstrumentToken, pos.Exchange);
                    continue;
                }
                var prefix = ExchangeToFeedPrefix(pos.Exchange);
                if (prefix is null)
                {
                    _logger.LogWarning(
                        "PositionStreamCoordinator [{Id}]: unsupported exchange '{Exchange}' for token '{Token}' — skipping",
                        _connectionId, pos.Exchange, pos.InstrumentToken);
                    continue;
                }
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

    // ── Webhook-triggered actions ─────────────────────────────────────────────

    /// <summary>
    /// Called by the broker webhook handler when an order fill is confirmed.
    /// Fetches fresh positions immediately and pushes them to the client.
    /// </summary>
    public async Task TriggerRefreshAsync()
    {
        try
        {
            var ct = _cts.Token;
            var allPositions = await FetchAllPositionsAsync(ct);
            var filtered     = ApplyFilter(allPositions);
            await _hub.Clients.Client(_connectionId)
                .SendAsync("ReceivePositions", filtered.Select(p => p.ToResponse()).ToList(), ct);
            _logger.LogInformation(
                "PositionStreamCoordinator [{Id}] ({User}): webhook refresh — pushed {Count} position(s)",
                _connectionId, Username, filtered.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "PositionStreamCoordinator [{Id}] ({User}): error during webhook-triggered refresh",
                _connectionId, Username);
        }
    }

    /// <summary>
    /// Called by the broker webhook handler to push an order status update to the client.
    /// </summary>
    public Task PushOrderUpdateAsync(
        string orderId, string status, string statusMessage, string tradingSymbol,
        decimal averagePrice, string transactionType, int filledQuantity)
    {
        _logger.LogInformation(
            "PositionStreamCoordinator [{Id}] ({User}): order {Status} — {Symbol}",
            _connectionId, Username, status.ToUpperInvariant(), tradingSymbol);
        return _hub.Clients.Client(_connectionId).SendAsync("ReceiveOrderUpdate", new
        {
            orderId, status, statusMessage, tradingSymbol,
            averagePrice, transactionType, filledQuantity,
        }, _cts.Token);
    }

    // ── LTP feed handler ──────────────────────────────────────────────────────

    private void OnFeedReceived(object? sender, LtpUpdate update)
    {
        // Upstox: feed token == instrument token → push as-is
        // Zerodha: feed token (NSE_FO|885247) → push with native numeric token so frontend matches
        var relevant = new List<object>(capacity: update.Ltps.Count);
        foreach (var (feedToken, ltp) in update.Ltps)
        {
            if (_subscribedUpstoxTokens.ContainsKey(feedToken))
                relevant.Add(new { instrumentToken = feedToken, ltp });
            if (_zerodhaFeedToNative.TryGetValue(feedToken, out var native))
                relevant.Add(new { instrumentToken = native, ltp });
        }

        if (relevant.Count == 0) return;

        _logger.LogDebug(
            "PositionStreamCoordinator [{Id}]: pushing ReceiveLtpBatch — {Count} instrument(s)",
            _connectionId, relevant.Count);

        _ = _hub.Clients.Client(_connectionId).SendAsync("ReceiveLtpBatch", relevant);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private IReadOnlyList<KAITerminal.Contracts.Domain.BrokerPosition> ApplyFilter(
        IReadOnlyList<KAITerminal.Contracts.Domain.BrokerPosition> positions)
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
