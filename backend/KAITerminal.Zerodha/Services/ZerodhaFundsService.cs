using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

internal sealed class ZerodhaFundsService : IBrokerFundsService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaFundsService(ZerodhaHttpClient http) => _http = http;

    public Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
        => _http.GetFundsAsync(ct);
}
