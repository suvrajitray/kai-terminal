using System.Net.WebSockets;

namespace KAITerminal.MarketData.Streaming;

/// <summary>
/// Reads binary WebSocket frames, reassembles multi-frame messages,
/// and delivers each complete message to the caller's handler.
/// </summary>
internal static class WebSocketFrameReader
{
    /// <summary>
    /// Reads frames from <paramref name="ws"/> until the socket closes or
    /// <paramref name="ct"/> is cancelled.
    /// Each complete binary message is passed to <paramref name="onMessage"/>
    /// as a (buffer, count) pair — the buffer may be larger than <paramref name="count"/>.
    /// Text and Close frames end the loop immediately.
    /// </summary>
    public static async Task ReadAsync(
        ClientWebSocket ws,
        Action<byte[], int> onMessage,
        CancellationToken ct)
    {
        var buffer = new byte[65536];
        using var ms = new MemoryStream(65536);

        while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
        {
            ms.SetLength(0);
            WebSocketReceiveResult result;

            do
            {
                result = await ws.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close) return;
                ms.Write(buffer, 0, result.Count);
            } while (!result.EndOfMessage);

            if (result.MessageType == WebSocketMessageType.Binary)
                onMessage(ms.GetBuffer(), (int)ms.Length);
        }
    }
}
