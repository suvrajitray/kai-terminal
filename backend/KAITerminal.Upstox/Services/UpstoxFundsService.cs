using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox.Http;

namespace KAITerminal.Upstox.Services;

internal sealed class UpstoxFundsService : IBrokerFundsService
{
    private readonly UpstoxHttpClient _http;

    public UpstoxFundsService(UpstoxHttpClient http)
    {
        _http = http;
    }

    public async Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
    {
        var r = await _http.GetFundsAsync(ct);
        return new BrokerFunds(r.AvailableMargin, r.UsedMargin, r.PayinAmount);
    }
}
