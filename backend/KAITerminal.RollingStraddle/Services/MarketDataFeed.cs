using KAITerminal.MarketData.Http;
using KAITerminal.MarketData.Models;
using KAITerminal.RollingStraddle.Configuration;
using KAITerminal.RollingStraddle.Logic;
using KAITerminal.Upstox.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RollingStraddle.Services;

internal sealed class MarketDataFeed
{
    private readonly UpstoxMarketDataHttpClient _client;
    private readonly StrategyConfig             _cfg;
    private readonly string                     _token;
    private readonly ILogger<MarketDataFeed>    _log;

    public MarketDataFeed(
        UpstoxMarketDataHttpClient client,
        IOptions<StrategyConfig>   config,
        IOptions<UpstoxConfig>     upstoxConfig,
        ILogger<MarketDataFeed>    log)
    {
        _client = client;
        _cfg    = config.Value;
        _token  = upstoxConfig.Value.AccessToken is { Length: > 0 } t
            ? t
            : throw new InvalidOperationException(
                "Upstox:AccessToken is required. Set it via: " +
                "dotnet user-secrets set \"Upstox:AccessToken\" \"<token>\"");
        _log    = log;
    }

    internal async Task<decimal> FetchSpotAsync(CancellationToken ct)
    {
        var quotes = await _client.GetMarketQuotesAsync(_token, [_cfg.Underlying], ct);
        return Normalise(quotes).TryGetValue(_cfg.Underlying, out var q) ? q.LastPrice : 0m;
    }

    internal async Task<decimal> FetchVixAsync(CancellationToken ct)
    {
        const string VixKey = "NSE_INDEX|India VIX";
        var quotes = await _client.GetMarketQuotesAsync(_token, [VixKey], ct);
        return Normalise(quotes).TryGetValue(VixKey, out var q) ? q.LastPrice : 0m;
    }

    internal async Task<(decimal AtmStrike, decimal CeStrike, decimal PeStrike, string Ce, string Pe)?> FindAtmAsync(
        decimal spot, CancellationToken ct)
    {
        var chain  = await _client.GetOptionChainAsync(_token, _cfg.Underlying, _cfg.Expiry, ct);
        var result = StrikeSelector.Select(chain, spot, _cfg.StrikeOffset);
        if (result is null)
            _log.LogError("[ENTRY] Leg selection failed ({Count} entries, offset {Off})  |  Spot {Spot:F2}",
                chain.Count, _cfg.StrikeOffset, spot);
        return result;
    }

    private static Dictionary<string, MarketQuote> Normalise(IReadOnlyDictionary<string, MarketQuote> raw) =>
        raw.ToDictionary(kv => kv.Key.Replace(':', '|'), kv => kv.Value);
}
