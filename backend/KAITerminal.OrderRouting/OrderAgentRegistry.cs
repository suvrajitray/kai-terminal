using System.Collections.Concurrent;
using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.OrderRouting;

public sealed class OrderAgentRegistry : IOrderAgentRegistry
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ConcurrentDictionary<string, AgentRegistration> _agents
        = new(StringComparer.OrdinalIgnoreCase);

    public OrderAgentRegistry(IServiceScopeFactory scopeFactory)
        => _scopeFactory = scopeFactory;

    public AgentRegistration? GetAgent(string username)
        => _agents.TryGetValue(username, out var reg) ? reg : null;

    public void Upsert(string username, string agentUrl)
        => _agents[username] = new AgentRegistration(agentUrl);

    public void Remove(string username)
        => _agents.TryRemove(username, out _);

    public async Task LoadAsync(CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var agents = await db.UserOrderAgents
            .Where(a => a.IsEnabled)
            .ToListAsync(ct);
        foreach (var a in agents)
            _agents[a.Username] = new AgentRegistration(a.AgentUrl);
    }
}
