using System.Collections.Concurrent;
using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Services;

namespace KAITerminal.Api.Hubs;

/// <summary>
/// Manages Zerodha LTP feed subscriptions for a single SignalR connection.
/// Maps Upstox-style feed tokens (e.g. <c>NSE_FO|885247</c>) to Zerodha native tokens
/// (e.g. trading symbol <c>NIFTY2641320700PE</c>) via the public Kite instrument CSV.
/// </summary>
internal sealed class ZerodhaFeedSubscriptionManager
{
    private readonly ISharedMarketDataService  _sharedMarketData;
    private readonly IZerodhaInstrumentService _zerodhaInstruments;
    private readonly string                    _connectionId;
    private readonly ILogger                   _logger;

    private readonly ConcurrentDictionary<string, string> _feedToNative = new(StringComparer.Ordinal);

    public ZerodhaFeedSubscriptionManager(
        ISharedMarketDataService  sharedMarketData,
        IZerodhaInstrumentService zerodhaInstruments,
        string                    connectionId,
        ILogger                   logger)
    {
        _sharedMarketData   = sharedMarketData;
        _zerodhaInstruments = zerodhaInstruments;
        _connectionId       = connectionId;
        _logger             = logger;
    }

    /// <summary>
    /// Updates Zerodha subscriptions to match the open positions in <paramref name="allPositions"/>.
    /// Builds the feed-token → native-token map via the Kite instrument CSV, subscribes new tokens,
    /// and removes stale ones. Clears all mappings when no Zerodha positions are open.
    /// </summary>
    /// <returns>The number of active feed mappings after refresh.</returns>
    public async Task<int> RefreshAsync(
        IReadOnlyList<BrokerPosition> allPositions, CancellationToken ct)
    {
        var openZerodha = allPositions
            .Where(p => string.Equals(p.Broker ?? "", BrokerNames.Zerodha, StringComparison.OrdinalIgnoreCase)
                     && p.IsOpen
                     && !string.IsNullOrEmpty(p.InstrumentToken))
            .ToList();

        if (openZerodha.Count > 0)
        {
            var newFeedMap = await BuildFeedMapAsync(openZerodha, ct);
            if (newFeedMap.Count > 0)
            {
                var added = newFeedMap.Keys.Except(_feedToNative.Keys).ToList();
                if (added.Count > 0)
                    _logger.LogInformation(
                        "PositionStreamCoordinator [{Id}]: {New} new Zerodha instrument(s) — resubscribing all {Total}",
                        _connectionId, added.Count, newFeedMap.Count);
                await _sharedMarketData.SubscribeAsync(newFeedMap.Keys.ToList(), FeedMode.Ltpc, ct);
            }

            // Add new entries first — avoids a brief window where a live token is absent
            foreach (var kvp in newFeedMap)
                _feedToNative[kvp.Key] = kvp.Value;
            foreach (var key in _feedToNative.Keys.Except(newFeedMap.Keys).ToList())
                _feedToNative.TryRemove(key, out _);
        }
        else
        {
            // No open Zerodha positions — clear stale mappings so OnFeedReceived doesn't route phantom ticks
            _feedToNative.Clear();
        }

        return _feedToNative.Count;
    }

    /// <summary>
    /// Tries to map a feed token to its Zerodha native instrument token.
    /// Returns <c>false</c> if the token is not subscribed for this connection.
    /// </summary>
    public bool TryGetNativeToken(string feedToken, out string nativeToken) =>
        _feedToNative.TryGetValue(feedToken, out nativeToken!);

    private async Task<Dictionary<string, string>> BuildFeedMapAsync(
        IReadOnlyList<BrokerPosition> zerodhaPositions, CancellationToken ct)
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
}
