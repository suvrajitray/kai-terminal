using KAITerminal.Api.Mapping;
using KAITerminal.Api.Services;
using KAITerminal.Broker;
using KAITerminal.Contracts.Streaming;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

public sealed class PositionsHub : Hub
{
    private readonly IBrokerClientFactory     _brokerFactory;
    private readonly ISharedMarketDataService _sharedMarketData;
    private readonly PositionStreamManager    _manager;
    private readonly IHubContext<PositionsHub> _hubContext;
    private readonly ILogger<PositionsHub>    _logger;

    public PositionsHub(
        IBrokerClientFactory     brokerFactory,
        ISharedMarketDataService sharedMarketData,
        PositionStreamManager    manager,
        IHubContext<PositionsHub> hubContext,
        ILogger<PositionsHub>    logger)
    {
        _brokerFactory    = brokerFactory;
        _sharedMarketData = sharedMarketData;
        _manager          = manager;
        _hubContext       = hubContext;
        _logger           = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var qs = Context.GetHttpContext()?.Request.Query;
        var token = qs?["upstoxToken"].ToString();
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning("PositionsHub: connection {Id} rejected — no upstoxToken", Context.ConnectionId);
            Context.Abort();
            return;
        }

        var exchangeFilter = ParseExchanges(qs?["exchange"].ToString());
        var connectionId = Context.ConnectionId;

        var broker = _brokerFactory.Create("upstox", token);

        IReadOnlyList<KAITerminal.Contracts.Domain.Position> positions;
        using (broker.UseToken())
            positions = await broker.GetAllPositionsAsync();

        var filtered = ApplyFilter(positions, exchangeFilter);
        await Clients.Caller.SendAsync("ReceivePositions", filtered.Select(p => p.ToResponse()).ToList());

        var coordinator = new PositionStreamCoordinator(
            _hubContext, broker, _sharedMarketData,
            connectionId, exchangeFilter, _logger);

        await coordinator.StartAsync(positions);
        _manager.Add(connectionId, coordinator);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
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
