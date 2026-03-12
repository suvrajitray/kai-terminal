using System.Collections.Concurrent;

namespace KAITerminal.Api.Services;

public sealed class IndexStreamManager
{
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _connections = new();

    public CancellationToken Add(string connectionId)
    {
        var cts = new CancellationTokenSource();
        _connections[connectionId] = cts;
        return cts.Token;
    }

    public void Remove(string connectionId)
    {
        if (_connections.TryRemove(connectionId, out var cts))
        {
            cts.Cancel();
            cts.Dispose();
        }
    }
}
