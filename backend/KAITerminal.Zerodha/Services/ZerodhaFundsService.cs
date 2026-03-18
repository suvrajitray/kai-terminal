using KAITerminal.Broker;
using KAITerminal.Zerodha.Http;

namespace KAITerminal.Zerodha.Services;

public sealed class ZerodhaFundsService : IZerodhaFundsService
{
    private readonly ZerodhaHttpClient _http;

    public ZerodhaFundsService(ZerodhaHttpClient http) => _http = http;

    public Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
        => _http.GetFundsAsync(ct);
}
