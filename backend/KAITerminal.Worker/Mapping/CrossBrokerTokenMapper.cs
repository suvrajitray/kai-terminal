using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Streaming;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker.Mapping;

/// <summary>
/// Builds bidirectional maps between native broker instrument tokens (e.g. Zerodha's
/// "16017410") and Upstox feed tokens (e.g. "NSE_FO|885247") using the universal
/// exchange-level token shared across all brokers.
///
/// The Upstox feed token is constructed directly as "{prefix}|{exchangeToken}" —
/// no Upstox API calls are required. Only 2 public Zerodha CSV downloads are needed.
///
/// Broker-agnostic: accepts any number of <see cref="ITokenMappingProvider"/> registrations.
/// Adding a new broker requires only registering its <c>ITokenMappingProvider</c> —
/// this class requires zero changes.
///
/// Upstox tokens are already in feed format and are passed through unchanged.
/// </summary>
public sealed class CrossBrokerTokenMapper : ITokenMapper
{
    private readonly IReadOnlyList<ITokenMappingProvider> _providers;
    private readonly ILogger<CrossBrokerTokenMapper>      _logger;

    // (brokerType, nativeToken) → upstox feed token
    private volatile Dictionary<(string, string), string> _nativeToFeed = new();
    // (brokerType, upstox feed token) → native token
    private volatile Dictionary<(string, string), string> _feedToNative = new();

    // Stored as DayNumber (int) so volatile is valid. DateOnly.DayNumber is unique per calendar day.
    private volatile int _loadedDateDayNumber;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public CrossBrokerTokenMapper(
        IEnumerable<ITokenMappingProvider> providers,
        ILogger<CrossBrokerTokenMapper>    logger)
    {
        _providers = providers.ToList();
        _logger    = logger;
    }

    public async Task EnsureReadyAsync(string brokerType, CancellationToken ct)
    {
        // Upstox tokens are already in feed format — nothing to build
        if (IsUpstox(brokerType)) return;

        var today = IstToday();
        if (_loadedDateDayNumber == today.DayNumber && _nativeToFeed.Count > 0) return;

        await _lock.WaitAsync(ct);
        try
        {
            if (_loadedDateDayNumber == today.DayNumber && _nativeToFeed.Count > 0) return;
            await LoadMappingAsync(ct);
            _loadedDateDayNumber = today.DayNumber;
        }
        finally { _lock.Release(); }
    }

    public IReadOnlyList<string> ToFeedTokens(string brokerType, IReadOnlyList<string> nativeTokens)
    {
        // Upstox tokens are already feed tokens — pass through unchanged
        if (IsUpstox(brokerType)) return nativeTokens;

        var result = new List<string>(nativeTokens.Count);
        foreach (var token in nativeTokens)
        {
            if (_nativeToFeed.TryGetValue((brokerType, token), out var feedToken))
                result.Add(feedToken);
            else
                _logger.LogDebug(
                    "CrossBrokerTokenMapper: no feed-token mapping for {Broker} token {Token}",
                    brokerType, token);
        }
        return result;
    }

    public string ToNativeToken(string brokerType, string feedToken)
    {
        if (IsUpstox(brokerType)) return feedToken;
        return _feedToNative.TryGetValue((brokerType, feedToken), out var native) ? native : feedToken;
    }

    // ── Mapping load ─────────────────────────────────────────────────────────

    private async Task LoadMappingAsync(CancellationToken ct)
    {
        var nativeToFeed = new Dictionary<(string, string), string>();
        var feedToNative = new Dictionary<(string, string), string>();

        foreach (var provider in _providers)
        {
            int mapped = 0, skipped = 0;
            IReadOnlyList<NativeContractKey> keys;

            try
            {
                // Public endpoints (e.g. Zerodha CSV) need no credentials
                keys = await provider.GetNativeContractKeysAsync("", null, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "CrossBrokerTokenMapper: failed to fetch native keys from {Broker} — skipping",
                    provider.BrokerType);
                continue;
            }

            foreach (var k in keys)
            {
                var prefix = SegmentToPrefix(k.Segment);
                if (prefix is null)
                {
                    _logger.LogDebug(
                        "CrossBrokerTokenMapper: unknown segment {Segment} for symbol {Symbol} — skipping",
                        k.Segment, k.TradingSymbol);
                    skipped++;
                    continue;
                }

                var feedToken = $"{prefix}|{k.ExchangeToken}";
                nativeToFeed[(provider.BrokerType, k.TradingSymbol)] = feedToken;
                feedToNative[(provider.BrokerType, feedToken)]        = k.TradingSymbol;
                mapped++;
            }

            _logger.LogInformation(
                "CrossBrokerTokenMapper: {Broker} — {Mapped} token mappings built ({Skipped} skipped)",
                provider.BrokerType, mapped, skipped);
        }

        _nativeToFeed = nativeToFeed;
        _feedToNative = feedToNative;
    }

    /// <summary>
    /// Maps a Zerodha segment string to the corresponding Upstox exchange prefix.
    /// Returns null for unrecognised segments so they can be silently skipped.
    /// </summary>
    private static string? SegmentToPrefix(string segment) => segment switch
    {
        "NFO-OPT" or "NFO-FUT" => "NSE_FO",
        "BFO-OPT" or "BFO-FUT" => "BSE_FO",
        _ => null
    };

    private static DateOnly IstToday()
        => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(5.5));

    private static bool IsUpstox(string brokerType)
        => brokerType.Equals("upstox", StringComparison.OrdinalIgnoreCase);
}
