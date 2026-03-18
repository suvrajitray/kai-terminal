using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Options;

namespace KAITerminal.Zerodha.Options;

/// <summary>
/// Fetches Zerodha option contracts and exposes them via the broker-agnostic
/// <see cref="IOptionContractProvider"/> interface consumed by <c>MasterDataService</c>.
/// </summary>
public sealed class ZerodhaOptionContractProvider : IOptionContractProvider
{
    private static readonly string[] UnderlyingSymbols =
        ["NIFTY", "SENSEX", "BANKNIFTY", "FINNIFTY", "BANKEX"];

    private readonly ZerodhaClient _zerodha;

    public ZerodhaOptionContractProvider(ZerodhaClient zerodha) => _zerodha = zerodha;

    public string BrokerType => "zerodha";

    public async Task<IReadOnlyList<IndexContracts>> GetContractsAsync(
        string accessToken, string? apiKey, CancellationToken ct)
    {
        using (ZerodhaTokenContext.Use(apiKey ?? "", accessToken))
        {
            var tasks = UnderlyingSymbols.Select(async symbol =>
            {
                var all = await _zerodha.GetOptionContractsAsync(symbol, ct);

                var entries = all
                    .Select(c => new ContractEntry(
                        c.Expiry, c.ExchangeToken, c.LotSize,
                        c.InstrumentType,
                        UpstoxToken: "",
                        ZerodhaToken: c.InstrumentToken,
                        c.Strike))
                    .ToList();

                return new IndexContracts(symbol, entries);
            });

            return await Task.WhenAll(tasks);
        }
    }
}
