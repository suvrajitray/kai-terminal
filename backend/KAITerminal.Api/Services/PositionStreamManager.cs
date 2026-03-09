using System.Collections.Concurrent;
using KAITerminal.Upstox.Services;

namespace KAITerminal.Api.Services;

public sealed class PositionStreamManager
{
    private readonly record struct StreamerPair(IPortfolioStreamer Portfolio, IMarketDataStreamer MarketData);

    private readonly ConcurrentDictionary<string, StreamerPair> _connections = new();

    public void Add(string connectionId, IPortfolioStreamer portfolio, IMarketDataStreamer marketData)
        => _connections[connectionId] = new StreamerPair(portfolio, marketData);

    public async Task RemoveAsync(string connectionId)
    {
        if (_connections.TryRemove(connectionId, out var pair))
        {
            await pair.Portfolio.DisposeAsync();
            await pair.MarketData.DisposeAsync();
        }
    }
}
