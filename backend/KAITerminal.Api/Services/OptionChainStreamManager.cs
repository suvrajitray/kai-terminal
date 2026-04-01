using System.Collections.Concurrent;
using KAITerminal.Api.Hubs;

namespace KAITerminal.Api.Services;

/// <summary>
/// Tracks per-connection <see cref="OptionChainCoordinator"/> instances for <see cref="OptionChainHub"/>.
/// </summary>
public sealed class OptionChainStreamManager
{
    private readonly ConcurrentDictionary<string, IAsyncDisposable> _connections = new();

    public void Add(string connectionId, IAsyncDisposable coordinator)
        => _connections[connectionId] = coordinator;

    internal OptionChainCoordinator? GetCoordinator(string connectionId)
        => _connections.TryGetValue(connectionId, out var c) ? c as OptionChainCoordinator : null;

    public async Task RemoveAsync(string connectionId)
    {
        if (_connections.TryRemove(connectionId, out var coordinator))
            await coordinator.DisposeAsync();
    }
}
