using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.Upstox.Services;

public interface IFundsService
{
    Task<FundsResponse> GetFundsAsync(CancellationToken ct = default);
}
