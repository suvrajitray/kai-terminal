using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using KAITerminal.Contracts.Streaming;
using KAITerminal.MarketData.Configuration;
using KAITerminal.MarketData.Http;
using KAITerminal.MarketData.Protos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MarketFeedMode = KAITerminal.MarketData.Streaming.FeedMode;

namespace KAITerminal.MarketData.Streaming;

/// <summary>
/// Upstox market data WebSocket streamer for the shared analytics-token feed.
/// Unlike the Upstox SDK's MarketDataStreamer, this class receives the token at
/// construction time — no ambient token context is required.
/// </summary>
internal sealed class UpstoxMarketDataStreamer : IMarketDataStreamer
{
    private readonly UpstoxMarketDataHttpClient _http;
    private readonly MarketDataConfig           _config;
    private readonly ILogger<UpstoxMarketDataStreamer> _logger;
    private readonly string                     _token;
    private readonly SemaphoreSlim              _sendLock = new(1, 1);
    private readonly ConcurrentDictionary<string, MarketFeedMode> _subscriptions = new();

    private ClientWebSocket? _ws;
    private CancellationTokenSource? _cts;
    private Task _receiveLoop = Task.CompletedTask;
    private bool _disposed;

    public event EventHandler<LtpUpdate>? FeedReceived;
    public event EventHandler? Reconnecting;
    public event EventHandler? Connected;
    public event EventHandler<Exception?>? Disconnected;
    public event EventHandler? AutoReconnectStopped;

    public UpstoxMarketDataStreamer(
        UpstoxMarketDataHttpClient http,
        IOptions<MarketDataConfig> options,
        ILogger<UpstoxMarketDataStreamer> logger,
        string token)
    {
        _http   = http;
        _config = options.Value;
        _logger = logger;
        _token  = token;
    }

    // ──────────────────────────────────────────────────
    // IMarketDataStreamer (Contracts)
    // ──────────────────────────────────────────────────

    public async Task ConnectAsync(CancellationToken ct)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);

        var uri = await _http.GetMarketDataFeedUriAsync(_token, _cts.Token);
        _ws = new ClientWebSocket();
        await _ws.ConnectAsync(new Uri(uri), _cts.Token);

        Connected?.Invoke(this, EventArgs.Empty);
        _receiveLoop = ReceiveLoopAsync(_cts.Token);
    }

    public async Task DisconnectAsync()
    {
        _cts?.Cancel();
        _ws?.Abort(); // unblocks any pending ReceiveAsync immediately

        try { await _receiveLoop; }
        catch { /* ignore */ }
    }

    public async Task SubscribeAsync(IReadOnlyCollection<string> instrumentTokens, Contracts.Streaming.FeedMode mode)
    {
        var keys       = instrumentTokens.ToList();
        var upstoxMode = MapFeedMode(mode);
        foreach (var k in keys) _subscriptions[k] = upstoxMode;
        await SendJsonAsync(BuildSubscribeMessage(keys, upstoxMode), CancellationToken.None);
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        _cts?.Cancel();
        _ws?.Abort(); // unblocks any pending ReceiveAsync immediately — no WS close handshake needed on shutdown

        try { await _receiveLoop; }
        catch { /* ignore */ }

        _ws?.Dispose();
        _cts?.Dispose();
        _sendLock.Dispose();
    }

    // ──────────────────────────────────────────────────
    // Receive loop + auto-reconnect
    // ──────────────────────────────────────────────────

    private async Task ReceiveLoopAsync(CancellationToken ct)
    {
        Exception? disconnectReason = null;

        try
        {
            await ReadFramesAsync(ct);
            if (ct.IsCancellationRequested) return;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
        catch (Exception ex) { disconnectReason = ex; }

        Disconnected?.Invoke(this, disconnectReason);

        if (_config.AutoReconnect && !ct.IsCancellationRequested)
            await RunAutoReconnectAsync(ct);
        else if (!ct.IsCancellationRequested)
            AutoReconnectStopped?.Invoke(this, EventArgs.Empty);
    }

    private async Task ReadFramesAsync(CancellationToken ct)
    {
        var buffer = new byte[65536];
        using var ms = new MemoryStream(65536);

        while (_ws!.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            ms.SetLength(0);
            WebSocketReceiveResult result;

            do
            {
                result = await _ws.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close) return;
                ms.Write(buffer, 0, result.Count);
            } while (!result.EndOfMessage);

            if (result.MessageType == WebSocketMessageType.Binary)
                ProcessBinaryMessage(ms.GetBuffer(), (int)ms.Length);
        }
    }

    private async Task RunAutoReconnectAsync(CancellationToken ct)
    {
        for (int attempt = 1; attempt <= _config.MaxReconnectAttempts; attempt++)
        {
            if (ct.IsCancellationRequested) return;

            Reconnecting?.Invoke(this, EventArgs.Empty);

            try
            {
                var delay = TimeSpan.FromSeconds(_config.ReconnectIntervalSeconds * attempt);
                await Task.Delay(delay, ct);

                var uri = await _http.GetMarketDataFeedUriAsync(_token, ct);
                _ws?.Dispose();
                _ws = new ClientWebSocket();
                await _ws.ConnectAsync(new Uri(uri), ct);

                Connected?.Invoke(this, EventArgs.Empty);
                await ResubscribeAllAsync(ct);
                await ReceiveLoopAsync(ct);
                return;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Market data stream reconnect attempt {Attempt}/{Max} failed",
                    attempt, _config.MaxReconnectAttempts);
            }
        }

        _logger.LogError(
            "Market data stream failed to reconnect after {Max} attempt(s) — stream permanently disconnected",
            _config.MaxReconnectAttempts);
        AutoReconnectStopped?.Invoke(this, EventArgs.Empty);
    }

    private async Task ResubscribeAllAsync(CancellationToken ct)
    {
        var groups = _subscriptions.ToArray()
            .GroupBy(kv => kv.Value)
            .Select(g => (Mode: g.Key, Keys: g.Select(kv => kv.Key).ToList()))
            .ToList();

        foreach (var (mode, keys) in groups)
            await SendJsonAsync(BuildSubscribeMessage(keys, mode), ct);
    }

    // ──────────────────────────────────────────────────
    // Protobuf decoding → LtpUpdate
    // ──────────────────────────────────────────────────

    private void ProcessBinaryMessage(byte[] buffer, int count)
    {
        try
        {
            var proto = FeedResponse.Parser.ParseFrom(buffer, 0, count);

            if (proto.Feeds.Count == 0) return;

            var ltps = new Dictionary<string, decimal>(proto.Feeds.Count);
            foreach (var kv in proto.Feeds)
            {
                var ltp = ExtractLtp(kv.Value);
                if (ltp.HasValue)
                    ltps[kv.Key] = ltp.Value;
            }

            if (ltps.Count > 0)
                FeedReceived?.Invoke(this, new LtpUpdate(ltps));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse market data frame ({Length} bytes)", count);
        }
    }

    private static decimal? ExtractLtp(Feed feed) => feed.FeedUnionCase switch
    {
        Feed.FeedUnionOneofCase.Ltpc                                             => (decimal?)feed.Ltpc.Ltp,
        Feed.FeedUnionOneofCase.FullFeed when feed.FullFeed.MarketFF is not null => (decimal?)feed.FullFeed.MarketFF.Ltpc.Ltp,
        Feed.FeedUnionOneofCase.FullFeed                                         => (decimal?)feed.FullFeed.IndexFF?.Ltpc.Ltp,
        Feed.FeedUnionOneofCase.FirstLevelWithGreeks                             => (decimal?)feed.FirstLevelWithGreeks.Ltpc.Ltp,
        _                                                                        => null
    };

    // ──────────────────────────────────────────────────
    // Outgoing message helpers
    // ──────────────────────────────────────────────────

    private async Task SendJsonAsync(object payload, CancellationToken ct)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(payload);
        await _sendLock.WaitAsync(ct);
        try { await _ws!.SendAsync(bytes, WebSocketMessageType.Binary, endOfMessage: true, ct); }
        finally { _sendLock.Release(); }
    }

    private static object BuildSubscribeMessage(IEnumerable<string> keys, MarketFeedMode mode) => new
    {
        guid   = Guid.NewGuid().ToString("N"),
        method = "sub",
        data   = new { mode = ToModeString(mode), instrumentKeys = keys }
    };

    private static MarketFeedMode MapFeedMode(Contracts.Streaming.FeedMode mode) => mode switch
    {
        Contracts.Streaming.FeedMode.Full => MarketFeedMode.Full,
        _                                 => MarketFeedMode.Ltpc,
    };

    private static string ToModeString(MarketFeedMode mode) => mode switch
    {
        MarketFeedMode.Ltpc         => "ltpc",
        MarketFeedMode.Full         => "full",
        MarketFeedMode.OptionGreeks => "option_greeks",
        MarketFeedMode.FullD30      => "full_d30",
        _ => throw new ArgumentOutOfRangeException(nameof(mode))
    };
}
