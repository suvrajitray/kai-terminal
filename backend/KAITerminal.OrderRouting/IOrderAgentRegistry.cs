namespace KAITerminal.OrderRouting;

public interface IOrderAgentRegistry
{
    AgentRegistration? GetAgent(string username);
    void Upsert(string username, string agentUrl);
    void Remove(string username);
    Task LoadAsync(CancellationToken ct = default);
}
