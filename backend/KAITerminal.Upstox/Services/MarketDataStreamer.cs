using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Configuration;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Protos;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.Upstox.Services;

internal sealed class MarketDataStreamer : IMarketDataStreamer
{
    private readonly UpstoxHttpClient _http;
    private readonly UpstoxConfig _config;
    private readonly ILogger<MarketDataStreamer> _logger;
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private readonly ConcurrentDictionary<string, FeedMode> _subscriptions = new();

    private ClientWebSocket? _ws;
    private CancellationTokenSource? _cts;
    private Task _receiveLoop = Task.CompletedTask;
    private bool _disposed;
    private string? _capturedToken; // token active at ConnectAsync time; restored during auto-reconnect

    public bool IsConnected => _ws?.State == WebSocketState.Open;

    public event EventHandler? Connected;
    public event EventHandler<Exception?>? Disconnected;
    public event EventHandler? Reconnecting;
    public event EventHandler? AutoReconnectStopped;
    public event EventHandler<MarketDataMessage>? FeedReceived;
    public event EventHandler<MarketSegmentStatus>? MarketStatusReceived;

    public MarketDataStreamer(UpstoxHttpClient http, IOptions<UpstoxConfig> options, ILogger<MarketDataStreamer> logger)
    {
        _http = http;
        _config = options.Value;
        _logger = logger;
    }

    // ──────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────

    public async Task ConnectAsync(CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        _capturedToken = UpstoxTokenContext.Current; // capture so reconnects reuse the same token
        _cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);

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

    public async Task SubscribeAsync(
        IEnumerable<string> instrumentKeys,
        FeedMode mode = FeedMode.Ltpc,
        CancellationToken ct = default)
    {
        var keys = instrumentKeys.ToList();
        foreach (var k in keys) _subscriptions[k] = mode;
        await SendJsonAsync(BuildSubscribeMessage(keys, mode), ct);
    }

    public async Task UnsubscribeAsync(IEnumerable<string> instrumentKeys, CancellationToken ct = default)
    {
        var keys = instrumentKeys.ToList();
        foreach (var k in keys) _subscriptions.TryRemove(k, out _);
        await SendJsonAsync(BuildUnsubscribeMessage(keys), ct);
    }

    public async Task ChangeModeAsync(
        IEnumerable<string> instrumentKeys, FeedMode mode, CancellationToken ct = default)
    {
        var keys = instrumentKeys.ToList();
        foreach (var k in keys) _subscriptions[k] = mode;
        await SendJsonAsync(BuildChangeModeMessage(keys, mode), ct);
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
    // Receive loop + auto-reconnect
    // ──────────────────────────────────────────────────

    private async Task ReceiveLoopAsync(CancellationToken ct)
    {
        Exception? disconnectReason = null;

        try
        {
            await ReadFramesAsync(ct);
            if (ct.IsCancellationRequested) return; // Intentional disconnect — no reconnect
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
                    return; // Server-initiated close → caller will fire Disconnected + reconnect
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

                // Continue the receive loop in-place (tail call avoids new Task allocation)
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
        var groups = _subscriptions
            .GroupBy(kv => kv.Value)
            .Select(g => (Mode: g.Key, Keys: g.Select(kv => kv.Key).ToList()))
            .ToList();

        foreach (var (mode, keys) in groups)
            await SendJsonAsync(BuildSubscribeMessage(keys, mode), ct);
    }

    // ──────────────────────────────────────────────────
    // Protobuf decoding → domain models
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

            var messageType = proto.Type switch
            {
                FeedResponse.Types.Type.InitialFeed => MessageType.InitialFeed,
                FeedResponse.Types.Type.LiveFeed    => MessageType.LiveFeed,
                _                                   => MessageType.LiveFeed
            };

            var instruments = proto.Feeds.ToDictionary(kv => kv.Key, kv => MapFeed(kv.Value));

            FeedReceived?.Invoke(this, new MarketDataMessage
            {
                Type        = messageType,
                TimestampMs = proto.CurrentTs,
                Timestamp   = DateTimeOffset.FromUnixTimeMilliseconds(proto.CurrentTs),
                Instruments = instruments
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse market data frame ({Length} bytes)", count);
        }
    }

    private static InstrumentFeed MapFeed(Feed proto) => proto.FeedUnionCase switch
    {
        Feed.FeedUnionOneofCase.Ltpc => new InstrumentFeed
        {
            Mode = FeedMode.Ltpc,
            Ltpc = MapLtpc(proto.Ltpc)
        },

        Feed.FeedUnionOneofCase.FullFeed when proto.FullFeed.MarketFF is not null => new InstrumentFeed
        {
            Mode = FeedMode.Full,
            Full = MapMarketFF(proto.FullFeed.MarketFF)
        },

        Feed.FeedUnionOneofCase.FullFeed => new InstrumentFeed
        {
            Mode = FeedMode.Full,
            Full = MapIndexFF(proto.FullFeed.IndexFF)
        },

        Feed.FeedUnionOneofCase.FirstLevelWithGreeks => new InstrumentFeed
        {
            Mode        = FeedMode.OptionGreeks,
            OptionGreeks = MapFirstLevelWithGreeks(proto.FirstLevelWithGreeks)
        },

        _ => new InstrumentFeed { Mode = FeedMode.Ltpc }
    };

    private static LtpcData MapLtpc(LTPC p) => new()
    {
        Ltp = (decimal)p.Ltp,
        Ltt = DateTimeOffset.FromUnixTimeMilliseconds(p.Ltt),
        Ltq = p.Ltq,
        Cp  = (decimal)p.Cp
    };

    private static FullFeedData MapMarketFF(MarketFF p) => new()
    {
        Ltpc    = MapLtpc(p.Ltpc),
        Vtt     = p.Vtt,
        Atp     = (decimal)p.Atp,
        Oi      = (decimal)p.Oi,
        Iv      = (decimal)p.Iv,
        Depth   = MapDepth(p.Depth),
        Ohlc    = p.OhlcData.Select(MapOhlc).ToList(),
        Greeks  = p.OptionGreeks is { } og ? MapGreeks(og) : null,
        IsIndex = false
    };

    private static FullFeedData MapIndexFF(IndexFF p) => new()
    {
        Ltpc    = MapLtpc(p.Ltpc),
        Ohlc    = p.OhlcData.Select(MapOhlc).ToList(),
        IsIndex = true
    };

    private static OptionGreeksFeedData MapFirstLevelWithGreeks(FirstLevelWithGreeks p) => new()
    {
        Ltpc   = MapLtpc(p.Ltpc),
        Vtt    = p.Vtt,
        Atp    = (decimal)p.Atp,
        Oi     = (decimal)p.Oi,
        Iv     = (decimal)p.Iv,
        Depth  = MapDepth(p.Depth),
        Greeks = p.OptionGreeks is { } og ? MapGreeks(og) : null
    };

    private static Models.WebSocket.Depth? MapDepth(Protos.Depth? p)
    {
        if (p is null) return null;
        return new Models.WebSocket.Depth(
            Bids: p.Bid.Select(MapBidAsk).ToList(),
            Asks: p.Ask.Select(MapBidAsk).ToList());
    }

    private static Models.WebSocket.BidAsk MapBidAsk(Protos.BidAsk b) => new()
    {
        Price    = (decimal)b.Price,
        Quantity = b.Quantity,
        Orders   = b.Orders
    };

    private static OhlcBar MapOhlc(OHLCData o) => new()
    {
        Interval  = o.Interval,
        Open      = (decimal)o.Open,
        High      = (decimal)o.High,
        Low       = (decimal)o.Low,
        Close     = (decimal)o.Close,
        Volume    = o.Vol,
        Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(o.Ts)
    };

    private static Greeks MapGreeks(Protos.OptionGreeks g) => new()
    {
        Delta = (decimal)g.Delta,
        Gamma = (decimal)g.Gamma,
        Theta = (decimal)g.Theta,
        Vega  = (decimal)g.Vega,
        Iv    = (decimal)g.Iv
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

    private static object BuildSubscribeMessage(IEnumerable<string> keys, FeedMode mode) => new
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

    private static object BuildChangeModeMessage(IEnumerable<string> keys, FeedMode mode) => new
    {
        guid   = Guid.NewGuid().ToString("N"),
        method = "change_mode",
        data   = new { mode = ToModeString(mode), instrumentKeys = keys }
    };

    private static string ToModeString(FeedMode mode) => mode switch
    {
        FeedMode.Ltpc         => "ltpc",
        FeedMode.Full         => "full",
        FeedMode.OptionGreeks => "option_greeks",
        FeedMode.FullD30      => "full_d30",
        _ => throw new ArgumentOutOfRangeException(nameof(mode))
    };
}
