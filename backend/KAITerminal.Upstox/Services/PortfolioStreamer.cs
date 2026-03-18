using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Configuration;
using KAITerminal.Upstox.Http;
using KAITerminal.Upstox.Models.WebSocket;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.Upstox.Services;

internal sealed class PortfolioStreamer : IPortfolioStreamer
{
    private readonly UpstoxHttpClient _http;
    private readonly UpstoxConfig _config;
    private readonly ILogger<PortfolioStreamer> _logger;

    private ClientWebSocket? _ws;
    private CancellationTokenSource? _cts;
    private Task _receiveLoop = Task.CompletedTask;
    private bool _disposed;
    private string? _capturedToken;

    private static readonly IEnumerable<UpdateType> DefaultUpdateTypes =
        [UpdateType.Order, UpdateType.Position];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public event EventHandler<PortfolioUpdate>? UpdateReceived;
    public event EventHandler? Reconnecting;

    // Additional Upstox-specific events kept on the implementation (not in Contracts interface)
    public event EventHandler? Connected;
    public event EventHandler<Exception?>? Disconnected;
    public event EventHandler? AutoReconnectStopped;

    public PortfolioStreamer(UpstoxHttpClient http, IOptions<UpstoxConfig> options, ILogger<PortfolioStreamer> logger)
    {
        _http = http;
        _config = options.Value;
        _logger = logger;
    }

    // ──────────────────────────────────────────────────
    // IPortfolioStreamer (Contracts)
    // ──────────────────────────────────────────────────

    public async Task ConnectAsync(CancellationToken ct)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        _capturedToken = UpstoxTokenContext.Current;
        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct);

        // Always subscribe to Order + Position updates internally
        var uri = await _http.GetPortfolioStreamFeedUriAsync(DefaultUpdateTypes, _cts.Token);
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

            if (result.MessageType == WebSocketMessageType.Text)
                ProcessTextMessage(ms.GetBuffer(), (int)ms.Length);
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
                    uri = await _http.GetPortfolioStreamFeedUriAsync(DefaultUpdateTypes, ct);
                _ws?.Dispose();
                _ws = new ClientWebSocket();
                await _ws.ConnectAsync(new Uri(uri), ct);

                Connected?.Invoke(this, EventArgs.Empty);

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
                    "Portfolio stream reconnect attempt {Attempt}/{Max} failed",
                    attempt, _config.MaxReconnectAttempts);
            }
        }

        _logger.LogError(
            "Portfolio stream failed to reconnect after {Max} attempt(s) — stream permanently disconnected",
            _config.MaxReconnectAttempts);
        AutoReconnectStopped?.Invoke(this, EventArgs.Empty);
    }

    // ──────────────────────────────────────────────────
    // JSON decoding → PortfolioUpdate (Contracts type)
    // ──────────────────────────────────────────────────

    private void ProcessTextMessage(byte[] buffer, int count)
    {
        try
        {
            var json = Encoding.UTF8.GetString(buffer, 0, count);
            var raw  = JsonSerializer.Deserialize<PortfolioStreamUpdate>(json, JsonOptions);
            if (raw is not null)
                UpdateReceived?.Invoke(this, new PortfolioUpdate(
                    raw.Type,
                    raw.OrderId,
                    raw.Status,
                    raw.StatusMessage,
                    raw.TradingSymbol));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse portfolio stream message ({Length} bytes)", count);
        }
    }
}
