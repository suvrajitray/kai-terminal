using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Options;

namespace KAITerminal.Upstox.Options;

/// <summary>
/// Fetches Upstox option contracts and exposes them via the broker-agnostic
/// <see cref="IOptionContractProvider"/> interface consumed by <c>MasterDataService</c>.
/// </summary>
public sealed class UpstoxOptionContractProvider : IOptionContractProvider
{
    private static readonly Dictionary<string, string> UnderlyingToIndex = new()
    {
        ["NSE_INDEX|Nifty 50"]          = "NIFTY",
        ["BSE_INDEX|SENSEX"]            = "SENSEX",
        ["NSE_INDEX|Nifty Bank"]        = "BANKNIFTY",
        ["NSE_INDEX|Nifty Fin Service"] = "FINNIFTY",
        ["BSE_INDEX|BANKEX"]            = "BANKEX",
    };

    private readonly UpstoxClient _upstox;

    public UpstoxOptionContractProvider(UpstoxClient upstox) => _upstox = upstox;

    public string BrokerType => "upstox";

    public async Task<IReadOnlyList<IndexContracts>> GetContractsAsync(
        string accessToken, string? apiKey, CancellationToken ct)
    {
        var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(5.5));

        var tasks = UnderlyingToIndex.Select(async kvp =>
        {
            IReadOnlyList<KAITerminal.Upstox.Models.Responses.OptionContract> all;
            using (UpstoxTokenContext.Use(accessToken))
                all = await _upstox.GetOptionContractsAsync(kvp.Key, cancellationToken: ct);

            var entries = all
                .Where(c =>
                    (c.InstrumentType == "CE" || c.InstrumentType == "PE") &&
                    DateOnly.TryParse(c.Expiry, out var expiry) && expiry.Year == today.Year)
                .OrderBy(c => c.Expiry)
                .Select(c => new ContractEntry(
                    c.Expiry, c.ExchangeToken, c.LotSize,
                    c.InstrumentType,
                    UpstoxToken: c.InstrumentKey,
                    ZerodhaToken: "",
                    c.StrikePrice))
                .ToList();

            return new IndexContracts(kvp.Value, entries);
        });

        return await Task.WhenAll(tasks);
    }
}
