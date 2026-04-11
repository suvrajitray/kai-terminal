using System.Collections.Concurrent;
using KAITerminal.Contracts.Streaming;

namespace KAITerminal.Api.Hubs;

public sealed class IndexStreamManager
{
    private readonly ConcurrentDictionary<string, EventHandler<LtpUpdate>> _handlers = new();

    public void Add(string connectionId, EventHandler<LtpUpdate> handler)
        => _handlers[connectionId] = handler;

    public EventHandler<LtpUpdate>? Remove(string connectionId)
    {
        _handlers.TryRemove(connectionId, out var handler);
        return handler;
    }
}
