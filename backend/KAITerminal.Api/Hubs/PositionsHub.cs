using KAITerminal.Api.Mapping;
using KAITerminal.Api.Services;
using KAITerminal.Broker;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Zerodha.Services;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

public sealed class PositionsHub : Hub
{
    private readonly IBrokerClientFactory      _brokerFactory;
    private readonly ISharedMarketDataService  _sharedMarketData;
    private readonly PositionStreamManager     _manager;
    private readonly IHubContext<PositionsHub> _hubContext;
    private readonly IZerodhaInstrumentService _zerodhaInstruments;
    private readonly ILogger<PositionsHub>     _logger;

    public PositionsHub(
        IBrokerClientFactory      brokerFactory,
        ISharedMarketDataService  sharedMarketData,
        PositionStreamManager     manager,
        IHubContext<PositionsHub> hubContext,
        IZerodhaInstrumentService zerodhaInstruments,
        ILogger<PositionsHub>     logger)
    {
        _brokerFactory      = brokerFactory;
        _sharedMarketData   = sharedMarketData;
        _manager            = manager;
        _hubContext         = hubContext;
        _zerodhaInstruments = zerodhaInstruments;
        _logger             = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var qs = Context.GetHttpContext()?.Request.Query;
        var token = qs?["upstoxToken"].ToString();
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning("PositionsHub: connection {Id} rejected — no upstoxToken in query string", Context.ConnectionId);
            Context.Abort();
            return;
        }

        var exchangeFilter = ParseExchanges(qs?["exchange"].ToString());
        var connectionId = Context.ConnectionId;
        var filterDesc = exchangeFilter is null ? "all exchanges" : string.Join(",", exchangeFilter);

        _logger.LogInformation("PositionsHub: client {Id} connected (filter: {Filter}) — fetching initial positions", connectionId, filterDesc);

        var broker = _brokerFactory.Create("upstox", token);

        IReadOnlyList<KAITerminal.Contracts.Domain.Position> positions;
        using (broker.UseToken())
            positions = await broker.GetAllPositionsAsync();

        var openCount = positions.Count(p => p.IsOpen);
        _logger.LogInformation(
            "PositionsHub: fetched {Total} position(s) for {Id} — {Open} open, {Closed} closed — sending ReceivePositions",
            positions.Count, connectionId, openCount, positions.Count - openCount);

        var filtered = ApplyFilter(positions, exchangeFilter);
        await Clients.Caller.SendAsync("ReceivePositions", filtered.Select(p => p.ToResponse()).ToList());

        // Build Zerodha feed map if Zerodha credentials are present
        var zerodhaToken  = qs?["zerodhaToken"].ToString();
        var zerodhaApiKey = qs?["zerodhaApiKey"].ToString();
        Dictionary<string, string>? zerodhaFeedMap = null;
        if (!string.IsNullOrWhiteSpace(zerodhaToken) && !string.IsNullOrWhiteSpace(zerodhaApiKey))
            zerodhaFeedMap = await BuildZerodhaFeedMapAsync(zerodhaToken, zerodhaApiKey, Context.ConnectionAborted);

        var coordinator = new PositionStreamCoordinator(
            _hubContext, broker, _sharedMarketData,
            connectionId, exchangeFilter, zerodhaFeedMap, _logger);

        await coordinator.StartAsync(positions);
        _manager.Add(connectionId, coordinator);

        _logger.LogInformation("PositionsHub: coordinator started for {Id} — live stream active", connectionId);

        await base.OnConnectedAsync();
    }

    // ── Zerodha LTP feed map ───────────────────────────────────────────────

    /// <summary>
    /// Builds a map from Upstox feed token (e.g. "NSE_FO|885247") to Zerodha native
    /// instrument token (e.g. "15942914") for all open Zerodha positions.
    /// Allows the <see cref="PositionStreamCoordinator"/> to subscribe Zerodha instruments
    /// to the shared Upstox market-data stream and push live LTP to the frontend.
    /// </summary>
    private async Task<Dictionary<string, string>> BuildZerodhaFeedMapAsync(
        string accessToken, string apiKey, CancellationToken ct)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        try
        {
            var zBroker = _brokerFactory.Create("zerodha", accessToken, apiKey);
            IReadOnlyList<KAITerminal.Contracts.Domain.Position> zerodhaPositions;
            using (zBroker.UseToken())
                zerodhaPositions = await zBroker.GetAllPositionsAsync(ct);

            var open = zerodhaPositions.Where(p => p.IsOpen).ToList();
            if (open.Count == 0) return map;

            // Look up exchange_token for each instrument using the Kite CSV
            var instruments = await _zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);
            var tokenLookup = instruments.ToDictionary(c => c.InstrumentToken, c => c.ExchangeToken);

            foreach (var pos in open)
            {
                if (!tokenLookup.TryGetValue(pos.InstrumentToken, out var exchangeToken)) continue;
                var prefix = ExchangeToFeedPrefix(pos.Exchange);
                if (prefix is null) continue;
                map[$"{prefix}|{exchangeToken}"] = pos.InstrumentToken;
            }

            _logger.LogInformation(
                "PositionsHub: Zerodha feed map — {Count}/{Total} open instrument(s) mapped",
                map.Count, open.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "PositionsHub: failed to build Zerodha feed map — Zerodha LTP will not be live");
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

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception is null)
            _logger.LogInformation("PositionsHub: client {Id} disconnected", Context.ConnectionId);
        else
            _logger.LogWarning(exception, "PositionsHub: client {Id} disconnected with error", Context.ConnectionId);

        await _manager.RemoveAsync(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static HashSet<string>? ParseExchanges(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var set = raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToUpperInvariant())
            .ToHashSet();
        return set.Count > 0 ? set : null;
    }

    private static IReadOnlyList<KAITerminal.Contracts.Domain.Position> ApplyFilter(
        IReadOnlyList<KAITerminal.Contracts.Domain.Position> positions, HashSet<string>? exchanges)
    {
        if (exchanges is null) return positions;
        return positions
            .Where(p => exchanges.Contains(p.Exchange.ToUpperInvariant()))
            .ToList()
            .AsReadOnly();
    }
}
