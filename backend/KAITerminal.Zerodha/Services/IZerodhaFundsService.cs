using KAITerminal.Broker;

namespace KAITerminal.Zerodha.Services;

public interface IZerodhaFundsService
{
    Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default);
}
