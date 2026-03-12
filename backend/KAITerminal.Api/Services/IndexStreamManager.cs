using System.Collections.Concurrent;
using KAITerminal.Upstox.Services;

namespace KAITerminal.Api.Services;

public sealed class IndexStreamManager
{
    private readonly ConcurrentDictionary<string, IMarketDataStreamer> _connections = new();

    public void Add(string connectionId, IMarketDataStreamer marketData)
        => _connections[connectionId] = marketData;

    public async Task RemoveAsync(string connectionId)
    {
        if (_connections.TryRemove(connectionId, out var streamer))
            await streamer.DisposeAsync();
    }
}
