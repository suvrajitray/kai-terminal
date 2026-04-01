using KAITerminal.Contracts;
using KAITerminal.Contracts.Broker;
using KAITerminal.MarketData.Services;

namespace KAITerminal.MarketData.Options;

/// <summary>
/// Provides Zerodha instrument tokens paired with their exchange-level token
/// so that <c>CrossBrokerTokenMapper</c> can construct Upstox feed tokens directly —
/// no Upstox API calls required.
/// </summary>
public sealed class ZerodhaTokenMappingProvider : ITokenMappingProvider
{
    private readonly IZerodhaInstrumentService _instruments;

    public ZerodhaTokenMappingProvider(IZerodhaInstrumentService instruments)
        => _instruments = instruments;

    public string BrokerType => BrokerNames.Zerodha;

    public async Task<IReadOnlyList<NativeContractKey>> GetNativeContractKeysAsync(
        string accessToken, string? apiKey, CancellationToken ct)
    {
        var all = await _instruments.GetAllCurrentYearContractsAsync(ct);

        return all
            .Select(c => new NativeContractKey(
                Segment:       c.Segment,
                ExchangeToken: c.ExchangeToken,
                TradingSymbol: c.TradingSymbol))
            .ToList();
    }
}
