using KAITerminal.Contracts.Domain;

namespace KAITerminal.Zerodha.Services;

public interface IZerodhaFundsService
{
    Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default);
}
