using System.Collections.Concurrent;

namespace KAITerminal.Api.Services;

/// <summary>
/// Tracks per-connection stream coordinators and disposes them on disconnect.
/// </summary>
public sealed class PositionStreamManager
{
    private readonly ConcurrentDictionary<string, IAsyncDisposable> _connections = new();

    public void Add(string connectionId, IAsyncDisposable coordinator)
        => _connections[connectionId] = coordinator;

    public async Task RemoveAsync(string connectionId)
    {
        if (_connections.TryRemove(connectionId, out var coordinator))
            await coordinator.DisposeAsync();
    }
}
