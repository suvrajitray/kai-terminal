using KAITerminal.Api.Services;
using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Services;
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

        var upstoxToken   = qs?["upstoxToken"].ToString();
        var zerodhaToken  = qs?["zerodhaToken"].ToString();
        var zerodhaApiKey = qs?["zerodhaApiKey"].ToString();

        var hasUpstox  = !string.IsNullOrWhiteSpace(upstoxToken);
        var hasZerodha = !string.IsNullOrWhiteSpace(zerodhaToken) && !string.IsNullOrWhiteSpace(zerodhaApiKey);

        if (!hasUpstox && !hasZerodha)
        {
            _logger.LogWarning("PositionsHub: connection {Id} rejected — no broker token in query string", Context.ConnectionId);
            Context.Abort();
            return;
        }

        var brokers = new List<IBrokerClient>();
        if (hasUpstox)  brokers.Add(_brokerFactory.Create(BrokerNames.Upstox,  upstoxToken!));
        if (hasZerodha) brokers.Add(_brokerFactory.Create(BrokerNames.Zerodha, zerodhaToken!, zerodhaApiKey!));

        var exchangeFilter = ParseExchanges(qs?["exchange"].ToString());
        var connectionId   = Context.ConnectionId;
        var username       = Context.User?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                          ?? Context.User?.FindFirst("email")?.Value
                          ?? "unknown";
        var filterDesc     = exchangeFilter is null ? "all exchanges" : string.Join(",", exchangeFilter);
        var brokerDesc     = string.Join("+", brokers.Select(b => b.BrokerType));

        _logger.LogInformation(
            "PositionsHub: client {Id} connected — user: {User}, brokers: {Brokers}, filter: {Filter}",
            connectionId, username, brokerDesc, filterDesc);

        var coordinator = new PositionStreamCoordinator(
            _hubContext, brokers, _sharedMarketData, _zerodhaInstruments,
            connectionId, username, exchangeFilter, _logger);

        await coordinator.StartAsync(Context.ConnectionAborted);
        _manager.Add(connectionId, coordinator);

        _logger.LogInformation("PositionsHub: coordinator started for {Id} — live stream active", connectionId);

        await base.OnConnectedAsync();
    }

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
}
