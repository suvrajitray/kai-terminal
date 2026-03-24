using KAITerminal.Contracts.Broker;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Zerodha.Options;

/// <summary>
/// Provides Zerodha numeric instrument tokens paired with their exchange-level token
/// so that <c>CrossBrokerTokenMapper</c> can construct Upstox feed tokens directly —
/// no Upstox API calls required.
///
/// Uses <see cref="IZerodhaInstrumentService.GetAllCurrentYearContractsAsync"/> which
/// downloads from the public Kite Connect instruments CSV — no access token required.
/// </summary>
public sealed class ZerodhaTokenMappingProvider : ITokenMappingProvider
{
    private readonly IZerodhaInstrumentService _instruments;

    public ZerodhaTokenMappingProvider(IZerodhaInstrumentService instruments)
        => _instruments = instruments;

    public string BrokerType => "zerodha";

    public async Task<IReadOnlyList<NativeContractKey>> GetNativeContractKeysAsync(
        string accessToken, string? apiKey, CancellationToken ct)
    {
        var all = await _instruments.GetAllCurrentYearContractsAsync(ct);

        return all
            .Select(c => new NativeContractKey(
                NativeToken:   c.InstrumentToken,
                Segment:       c.Segment,
                ExchangeToken: c.ExchangeToken,
                TradingSymbol: c.TradingSymbol))
            .ToList();
    }
}
