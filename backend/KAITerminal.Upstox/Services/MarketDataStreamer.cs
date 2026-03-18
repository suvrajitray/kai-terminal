using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Configuration;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Protos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using UpstoxFeedMode = KAITerminal.Upstox.Models.WebSocket.FeedMode;

namespace KAITerminal.Upstox.Services;

internal sealed class MarketDataStreamer : IMarketDataStreamer
{
    private readonly UpstoxHttpClient _http;
    private readonly UpstoxConfig _config;
    private readonly ILogger<MarketDataStreamer> _logger;
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private readonly ConcurrentDictionary<string, UpstoxFeedMode> _subscriptions = new();

    private ClientWebSocket? _ws;
    private CancellationTokenSource? _cts;
    private Task _receiveLoop = Task.CompletedTask;
    private bool _disposed;
    private string? _capturedToken; // token active at ConnectAsync time; restored during auto-reconnect

    public event EventHandler<LtpUpdate>? FeedReceived;
    public event EventHandler? Reconnecting;

    // Additional Upstox-specific events kept on the implementation (not in Contracts interface)
    public event EventHandler? Connected;
    public event EventHandler<Exception?>? Disconnected;
    public event EventHandler? AutoReconnectStopped;
    public event EventHandler<MarketSegmentStatus>? MarketStatusReceived;

    public MarketDataStreamer(UpstoxHttpClient http, IOptions<UpstoxConfig> options, ILogger<MarketDataStreamer> logger)
    {
        _http = http;
        _config = options.Value;
        _logger = logger;
    }

    // ──────────────────────────────────────────────────
    // IMarketDataStreamer (Contracts)
    // ──────────────────────────────────────────────────

    public async Task ConnectAsync(CancellationToken ct)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        _capturedToken = UpstoxTokenContext.Current;
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);

        var uri = await _http.GetMarketDataFeedUriV3Async(_cts.Token);
        _ws = new ClientWebSocket();
        await _ws.ConnectAsync(new Uri(uri), _cts.Token);

        Connected?.Invoke(this, EventArgs.Empty);
        _receiveLoop = ReceiveLoopAsync(_cts.Token);
    }

    public async Task DisconnectAsync()
    {
        _cts?.Cancel();

        try { await _receiveLoop; }
        catch { /* ignore */ }

        if (_ws?.State == WebSocketState.Open)
        {
            try { await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Disconnect", CancellationToken.None); }
            catch { /* ignore */ }
        }
    }

    public async Task SubscribeAsync(IReadOnlyCollection<string> instrumentTokens, Contracts.Streaming.FeedMode mode)
    {
        var keys = instrumentTokens.ToList();
        var upstoxMode = MapFeedMode(mode);
        foreach (var k in keys) _subscriptions[k] = upstoxMode;
        await SendJsonAsync(BuildSubscribeMessage(keys, upstoxMode), CancellationToken.None);
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        _cts?.Cancel();

        try { await _receiveLoop; }
        catch { /* ignore */ }

        if (_ws is not null)
        {
            try
            {
                if (_ws.State == WebSocketState.Open)
                    await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Disposed", CancellationToken.None);
            }
            catch { /* ignore */ }
            _ws.Dispose();
        }

        _cts?.Dispose();
        _sendLock.Dispose();
    }

    // ──────────────────────────────────────────────────
    // Upstox-specific helpers (used within SDK only)
    // ──────────────────────────────────────────────────

    public async Task UnsubscribeAsync(IEnumerable<string> instrumentKeys, CancellationToken ct = default)
    {
        var keys = instrumentKeys.ToList();
        foreach (var k in keys) _subscriptions.TryRemove(k, out _);
        await SendJsonAsync(BuildUnsubscribeMessage(keys), ct);
    }

    public async Task ChangeModeAsync(IEnumerable<string> instrumentKeys, UpstoxFeedMode mode, CancellationToken ct = default)
    {
        var keys = instrumentKeys.ToList();
        foreach (var k in keys) _subscriptions[k] = mode;
        await SendJsonAsync(BuildChangeModeMessage(keys, mode), ct);
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
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            return;
        }
        catch (Exception ex)
        {
            disconnectReason = ex;
        }

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
                if (result.MessageType == WebSocketMessageType.Close)
                    return;
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

                string uri;
                using (UpstoxTokenContext.Use(_capturedToken))
                    uri = await _http.GetMarketDataFeedUriV3Async(ct);
                _ws?.Dispose();
                _ws = new ClientWebSocket();
                await _ws.ConnectAsync(new Uri(uri), ct);

                Connected?.Invoke(this, EventArgs.Empty);
                await ResubscribeAllAsync(ct);

                await ReceiveLoopAsync(ct);
                return;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
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
        var snapshot = _subscriptions.ToArray();
        var groups = snapshot
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

            if (proto.MarketInfo is not null && proto.MarketInfo.SegmentStatus.Count > 0)
            {
                MarketStatusReceived?.Invoke(this, new MarketSegmentStatus
                {
                    Segments = new Dictionary<string, string>(proto.MarketInfo.SegmentStatus)
                });
            }

            if (proto.Feeds.Count == 0) return;

            // Extract LTPs; Contracts interface exposes a simple token→ltp map
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
        try
        {
            await _ws!.SendAsync(bytes, WebSocketMessageType.Binary, endOfMessage: true, ct);
        }
        finally
        {
            _sendLock.Release();
        }
    }

    private static object BuildSubscribeMessage(IEnumerable<string> keys, UpstoxFeedMode mode) => new
    {
        guid   = Guid.NewGuid().ToString("N"),
        method = "sub",
        data   = new { mode = ToModeString(mode), instrumentKeys = keys }
    };

    private static object BuildUnsubscribeMessage(IEnumerable<string> keys) => new
    {
        guid   = Guid.NewGuid().ToString("N"),
        method = "unsub",
        data   = new { instrumentKeys = keys }
    };

    private static object BuildChangeModeMessage(IEnumerable<string> keys, UpstoxFeedMode mode) => new
    {
        guid   = Guid.NewGuid().ToString("N"),
        method = "change_mode",
        data   = new { mode = ToModeString(mode), instrumentKeys = keys }
    };

    private static UpstoxFeedMode MapFeedMode(Contracts.Streaming.FeedMode mode) => mode switch
    {
        Contracts.Streaming.FeedMode.Full => UpstoxFeedMode.Full,
        _                                 => UpstoxFeedMode.Ltpc,
    };

    private static string ToModeString(UpstoxFeedMode mode) => mode switch
    {
        UpstoxFeedMode.Ltpc         => "ltpc",
        UpstoxFeedMode.Full         => "full",
        UpstoxFeedMode.OptionGreeks => "option_greeks",
        UpstoxFeedMode.FullD30      => "full_d30",
        _ => throw new ArgumentOutOfRangeException(nameof(mode))
    };
}
