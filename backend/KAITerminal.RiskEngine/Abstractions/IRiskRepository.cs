using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Abstractions;

public interface IRiskRepository
{
    UserRiskState GetOrCreate(string userId);
    void Update(string userId, UserRiskState state);
    void Reset(string userId);
}
