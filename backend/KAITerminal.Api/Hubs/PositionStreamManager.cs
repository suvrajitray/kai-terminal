using System.Collections.Concurrent;

namespace KAITerminal.Api.Hubs;

/// <summary>
/// Tracks per-connection <see cref="PositionStreamCoordinator"/> instances and disposes them on disconnect.
/// Also provides lookups by broker type and username so webhook handlers can push order updates instantly.
/// </summary>
public sealed class PositionStreamManager
{
    private readonly ConcurrentDictionary<string, PositionStreamCoordinator> _connections = new();

    public void Add(string connectionId, PositionStreamCoordinator coordinator)
        => _connections[connectionId] = coordinator;

    public async Task RemoveAsync(string connectionId)
    {
        if (_connections.TryRemove(connectionId, out var coordinator))
            await coordinator.DisposeAsync();
    }

    /// <summary>Returns all active coordinators that have the specified broker connected.</summary>
    public IEnumerable<PositionStreamCoordinator> GetAllForBroker(string brokerType)
        => _connections.Values.Where(c => c.HasBroker(brokerType));

    /// <summary>Returns all active coordinators for a specific user email.</summary>
    public IEnumerable<PositionStreamCoordinator> GetAllForUser(string username)
        => _connections.Values.Where(c =>
            c.Username.Equals(username, StringComparison.OrdinalIgnoreCase));
}
