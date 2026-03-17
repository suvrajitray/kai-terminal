using KAITerminal.Api.Services;
using KAITerminal.Upstox;
using Microsoft.AspNetCore.SignalR;

namespace KAITerminal.Api.Hubs;

public sealed class IndexHub : Hub
{
    private static readonly List<string> IndexTokens =
    [
        "NSE_INDEX|Nifty 50",
        "NSE_INDEX|Nifty Bank",
        "BSE_INDEX|SENSEX",
        "NSE_INDEX|Nifty Fin Service",
        "BSE_INDEX|BANKEX",
    ];

    private const int PollIntervalMs = 3000;

    private readonly UpstoxClient _upstox;
    private readonly IndexStreamManager _manager;
    private readonly IHubContext<IndexHub> _hubContext;
    private readonly ILogger<IndexHub> _logger;

    public IndexHub(UpstoxClient upstox, IndexStreamManager manager, IHubContext<IndexHub> hubContext, ILogger<IndexHub> logger)
    {
        _upstox = upstox;
        _manager = manager;
        _hubContext = hubContext;
        _logger = logger;
    }

    public override Task OnConnectedAsync()
    {
        var qs = Context.GetHttpContext()?.Request.Query;
        var token = qs?["upstoxToken"].ToString();
        if (string.IsNullOrWhiteSpace(token))
        {
            Context.Abort();
            return Task.CompletedTask;
        }

        var connectionId = Context.ConnectionId;
        var ct = _manager.Add(connectionId);

        _ = Task.Run(() => PollLoopAsync(token, connectionId, _hubContext, ct), ct);

        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _manager.Remove(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    private async Task PollLoopAsync(
        string token, string connectionId, IHubContext<IndexHub> hubContext, CancellationToken ct)
    {
        var first = true;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                IReadOnlyDictionary<string, KAITerminal.Upstox.Models.Responses.MarketQuote> quotes;
                using (UpstoxTokenContext.Use(token))
                    quotes = await _upstox.GetMarketQuotesAsync(IndexTokens, ct);

                // Upstox quotes API uses ':' separator; instrument tokens use '|'
                var normalised = quotes.ToDictionary(kv => kv.Key.Replace(':', '|'), kv => kv.Value);

                var updates = IndexTokens
                    .Where(normalised.ContainsKey)
                    .Select(t => new
                    {
                        instrumentToken = t,
                        ltp       = normalised[t].LastPrice,
                        open      = normalised[t].Ohlc?.Open,
                        high      = normalised[t].Ohlc?.High,
                        low       = normalised[t].Ohlc?.Low,
                        netChange = normalised[t].NetChange,
                    })
                    .ToList();

                if (updates.Count > 0)
                {
                    // First poll: send as snapshot (includes open/high); subsequent: batch (ltp only used by client)
                    var method = first ? "ReceiveIndexSnapshot" : "ReceiveIndexBatch";
                    await hubContext.Clients.Client(connectionId).SendAsync(method, updates, ct);
                    first = false;
                }
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Index quotes poll failed for connection {ConnectionId} — skipping tick", connectionId);
            }

            try { await Task.Delay(PollIntervalMs, ct); }
            catch (OperationCanceledException) { return; }
        }
    }
}
