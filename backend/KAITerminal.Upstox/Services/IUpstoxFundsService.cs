using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

public interface IUpstoxFundsService
{
    Task<FundsResponse> GetFundsAsync(CancellationToken ct = default);
}
