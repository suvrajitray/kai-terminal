using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Options;
using KAITerminal.MarketData.Services;

namespace KAITerminal.MarketData.Options;

/// <summary>
/// Fetches Zerodha option contracts and exposes them via the broker-agnostic
/// <see cref="IOptionContractProvider"/> interface consumed by <c>MasterDataService</c>.
/// </summary>
public sealed class ZerodhaOptionContractProvider : IOptionContractProvider
{
    private static readonly string[] UnderlyingSymbols =
        ["NIFTY", "SENSEX", "BANKNIFTY", "FINNIFTY", "BANKEX"];

    private readonly IZerodhaInstrumentService _instruments;

    public ZerodhaOptionContractProvider(IZerodhaInstrumentService instruments)
        => _instruments = instruments;

    public string BrokerType => "zerodha";

    public async Task<IReadOnlyList<IndexContracts>> GetContractsAsync(
        string accessToken, string? apiKey, CancellationToken ct)
    {
        var tasks = UnderlyingSymbols.Select(async symbol =>
        {
            var all = await _instruments.GetCurrentYearContractsAsync(symbol, ct);

            var entries = all
                .Select(c => new ContractEntry(
                    c.Expiry, c.ExchangeToken, (int)c.LotSize,
                    c.InstrumentType,
                    UpstoxToken: "",
                    ZerodhaToken: c.TradingSymbol,
                    c.Strike))
                .ToList();

            return new IndexContracts(symbol, entries);
        });

        return await Task.WhenAll(tasks);
    }
}
