using KAITerminal.RiskEngine.Models;

namespace KAITerminal.RiskEngine.Abstractions;

public interface IRiskRepository
{
    Task<UserRiskState> GetOrCreateAsync(string userId);
    Task UpdateAsync(string userId, UserRiskState state);
    Task ResetAsync(string userId);
}
