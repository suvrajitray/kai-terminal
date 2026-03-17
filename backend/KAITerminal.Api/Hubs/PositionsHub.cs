using KAITerminal.Api.Services;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Responses;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

public sealed class PositionsHub : Hub
{
    private readonly UpstoxClient _upstox;
    private readonly PositionStreamManager _manager;
    private readonly IHubContext<PositionsHub> _hubContext;
    private readonly ILogger<PositionsHub> _logger;

    public PositionsHub(
        UpstoxClient upstox,
        PositionStreamManager manager,
        IHubContext<PositionsHub> hubContext,
        ILogger<PositionsHub> logger)
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

        var exchangeFilter = ParseExchanges(qs?["exchange"].ToString());
        var connectionId = Context.ConnectionId;

        IReadOnlyList<Position> positions;
        using (UpstoxTokenContext.Use(token))
            positions = await _upstox.GetAllPositionsAsync();

        positions = ApplyFilter(positions, exchangeFilter);
        await Clients.Caller.SendAsync("ReceivePositions", positions);

        var coordinator = new PositionStreamCoordinator(
            _upstox, _hubContext, _logger, connectionId, token, exchangeFilter);
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

    private static IReadOnlyList<Position> ApplyFilter(
        IReadOnlyList<Position> positions, HashSet<string>? exchanges)
    {
        if (exchanges is null) return positions;
        return positions
            .Where(p => exchanges.Contains(p.Exchange.ToUpperInvariant()))
            .ToList()
            .AsReadOnly();
    }
}
