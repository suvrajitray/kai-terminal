using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Notifications;
using KAITerminal.MarketData.Models;
using KAITerminal.MarketData.Services;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker;

/// <summary>
/// Real auto-shift evaluator — lives in Worker because it depends on MarketData (option chain).
/// Registered before <c>AddRiskEngine</c> so <c>TryAddSingleton</c> does not override it.
///
/// On each tick, checks every sell position: if LTP has risen by <c>AutoShiftThresholdPct</c>
/// from entry, the position is shifted one <c>AutoShiftStrikeGap</c> further OTM.
/// After <c>AutoShiftMaxCount</c> shifts the position is exited entirely.
/// </summary>
internal sealed class AutoShiftEvaluator : IAutoShiftEvaluator
{
    // Maps underlying name (from Kite CSV) → Upstox index key (for option chain lookup)
    private static readonly IReadOnlyDictionary<string, string> UnderlyingKeys =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["NIFTY"]     = "NSE_INDEX|Nifty 50",
            ["BANKNIFTY"] = "NSE_INDEX|Nifty Bank",
            ["FINNIFTY"]  = "NSE_INDEX|Nifty Fin Service",
            ["SENSEX"]    = "BSE_INDEX|SENSEX",
            ["BANKEX"]    = "BSE_INDEX|BANKEX",
        };

    private readonly OptionStrikeService         _strikeSvc;
    private readonly IZerodhaInstrumentService   _zerodhaInstruments;
    private readonly IRiskRepository             _repo;
    private readonly IRiskEventNotifier          _notifier;
    private readonly IPositionCache              _cache;
    private readonly ILogger<AutoShiftEvaluator> _logger;

    public AutoShiftEvaluator(
        OptionStrikeService         strikeSvc,
        IZerodhaInstrumentService   zerodhaInstruments,
        IRiskRepository             repo,
        IRiskEventNotifier          notifier,
        IPositionCache              cache,
        ILogger<AutoShiftEvaluator> logger)
    {
        _strikeSvc          = strikeSvc;
        _zerodhaInstruments = zerodhaInstruments;
        _repo               = repo;
        _notifier           = notifier;
        _cache              = cache;
        _logger             = logger;
    }

    public async Task EvaluateAsync(
        string userId, UserConfig config, IBrokerClient broker, CancellationToken ct)
    {
        if (!config.AutoShiftEnabled)
            return;

        var state = await _repo.GetOrCreateAsync(userId);
        if (state.IsSquaredOff)
            return;

        var positions    = _cache.GetPositions(userId);
        var sellPositions = positions.Where(p => p.Quantity < 0).ToList();
        if (sellPositions.Count == 0)
            return;

        // Contracts are loaded lazily — only when at least one position crosses the threshold
        IReadOnlyList<ZerodhaOptionContract>? allContracts = null;

        foreach (var position in sellPositions)
        {
            var ltp       = _cache.GetEffectiveLtp(userId, position.InstrumentToken, position.Ltp);
            var threshold = position.AveragePrice * (1 + config.AutoShiftThresholdPct / 100m);

            if (ltp < threshold)
                continue;

            allContracts ??= await _zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);

            var contract = LookupContract(position, broker.BrokerType, allContracts);
            if (contract is null)
            {
                _logger.LogWarning(
                    "AutoShift — no contract found for token {Token} ({Broker}) — skipping",
                    position.InstrumentToken, broker.BrokerType);
                continue;
            }

            var chainKey   = $"{contract.Name}_{contract.Expiry}_{contract.InstrumentType}";
            var shiftCount = state.AutoShiftCounts.GetValueOrDefault(chainKey, 0);

            if (shiftCount >= config.AutoShiftMaxCount)
            {
                await ExitExhaustedPositionAsync(userId, position, broker, state, shiftCount, ct);
            }
            else
            {
                await ShiftPositionAsync(userId, position, contract, chainKey, broker, state, config, ct);
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task ExitExhaustedPositionAsync(
        string userId, Contracts.Domain.Position position, IBrokerClient broker,
        RiskEngine.Models.UserRiskState state, int shiftCount, CancellationToken ct)
    {
        var exitToken = BuildCloseToken(position, broker.BrokerType);

        _logger.LogWarning(
            "AutoShift exhausted for {UserId} ({Broker}) — exiting {Token} after {Count} shifts",
            userId, broker.BrokerType, exitToken, shiftCount);

        await broker.ExitPositionAsync(exitToken, position.Product, ct);

        await _notifier.NotifyAsync(new RiskNotification(
            UserId:          userId,
            Broker:          broker.BrokerType,
            Type:            RiskNotificationType.AutoShiftExhausted,
            Mtm:             _cache.GetMtm(userId),
            InstrumentToken: position.InstrumentToken,
            ShiftCount:      shiftCount,
            Timestamp:       DateTimeOffset.UtcNow), ct);
    }

    private async Task ShiftPositionAsync(
        string userId, Contracts.Domain.Position position, ZerodhaOptionContract contract,
        string chainKey, IBrokerClient broker,
        RiskEngine.Models.UserRiskState state, UserConfig config, CancellationToken ct)
    {
        // CE seller: higher strike = further OTM → positive gap
        // PE seller: lower strike  = further OTM → negative gap
        var strikeGap = contract.InstrumentType.Equals("CE", StringComparison.OrdinalIgnoreCase)
            ? config.AutoShiftStrikeGap
            : -config.AutoShiftStrikeGap;

        if (!UnderlyingKeys.TryGetValue(contract.Name, out var underlyingKey))
        {
            _logger.LogWarning("AutoShift — unknown underlying '{Name}' — skipping", contract.Name);
            return;
        }

        var newUpstoxKey = await _strikeSvc.FindByStrikeGapAsync(
            underlyingKey, contract.Expiry, contract.InstrumentType,
            contract.Strike, strikeGap, ct);

        if (newUpstoxKey is null)
        {
            _logger.LogWarning(
                "AutoShift — no target strike found for {ChainKey} (gap {Gap}) — skipping",
                chainKey, strikeGap);
            return;
        }

        var closeToken = BuildCloseToken(position, broker.BrokerType);
        var openToken  = BuildOpenToken(newUpstoxKey, broker.BrokerType,
            await _zerodhaInstruments.GetAllCurrentYearContractsAsync(ct));

        if (openToken is null)
        {
            _logger.LogWarning(
                "AutoShift — could not resolve open token for {UpstoxKey} ({Broker}) — skipping",
                newUpstoxKey, broker.BrokerType);
            return;
        }

        var qty        = Math.Abs(position.Quantity);
        var closeOrder = new BrokerOrderRequest(closeToken, qty, "BUY",  position.Product, "MARKET");
        var openOrder  = new BrokerOrderRequest(openToken,  qty, "SELL", position.Product, "MARKET");

        _logger.LogInformation(
            "AutoShift {ChainKey}: shift {Count}+1 — closing {Close}, opening {Open} for {UserId}",
            chainKey, state.AutoShiftCounts.GetValueOrDefault(chainKey, 0), closeToken, openToken, userId);

        // Short: close first (releases margin) then open the new short
        await broker.PlaceOrderAsync(closeOrder, ct);
        try
        {
            await broker.PlaceOrderAsync(openOrder, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "AutoShift PARTIAL — close {Close} succeeded but open {Open} failed for {UserId}. Manual intervention required.",
                closeToken, openToken, userId);
            throw;
        }

        var newCount = state.IncrementAutoShiftCount(chainKey);
        await _repo.UpdateAsync(userId, state);

        await _notifier.NotifyAsync(new RiskNotification(
            UserId:          userId,
            Broker:          broker.BrokerType,
            Type:            RiskNotificationType.AutoShiftTriggered,
            Mtm:             _cache.GetMtm(userId),
            InstrumentToken: position.InstrumentToken,
            NewToken:        openToken,
            ShiftCount:      newCount,
            Timestamp:       DateTimeOffset.UtcNow), ct);
    }

    private static ZerodhaOptionContract? LookupContract(
        Contracts.Domain.Position position, string brokerType,
        IReadOnlyList<ZerodhaOptionContract> contracts)
    {
        if (brokerType.Equals("zerodha", StringComparison.OrdinalIgnoreCase))
        {
            return contracts.FirstOrDefault(c =>
                c.TradingSymbol.Equals(position.InstrumentToken, StringComparison.OrdinalIgnoreCase));
        }

        // Upstox token format: "{exchange}|{exchange_token}" e.g. "NSE_FO|12345678"
        var exchangeToken = position.InstrumentToken.Contains('|')
            ? position.InstrumentToken.Split('|')[1]
            : position.InstrumentToken;

        return contracts.FirstOrDefault(c =>
            c.ExchangeToken.Equals(exchangeToken, StringComparison.OrdinalIgnoreCase));
    }

    private static string BuildCloseToken(Contracts.Domain.Position position, string brokerType)
    {
        if (brokerType.Equals("zerodha", StringComparison.OrdinalIgnoreCase))
        {
            // ZerodhaOrderService expects "{exchange}|{tradingSymbol}"
            return string.IsNullOrEmpty(position.Exchange)
                ? position.InstrumentToken
                : $"{position.Exchange}|{position.InstrumentToken}";
        }

        // Upstox: InstrumentToken is already the full instrument key
        return position.InstrumentToken;
    }

    private static string? BuildOpenToken(
        string upstoxKey, string brokerType,
        IReadOnlyList<ZerodhaOptionContract> contracts)
    {
        if (brokerType.Equals("upstox", StringComparison.OrdinalIgnoreCase))
            return upstoxKey;

        // Zerodha: derive exchange_token from the Upstox key, look up the trading symbol
        var exchangeToken = upstoxKey.Contains('|') ? upstoxKey.Split('|')[1] : upstoxKey;
        var match = contracts.FirstOrDefault(c =>
            c.ExchangeToken.Equals(exchangeToken, StringComparison.OrdinalIgnoreCase));

        return match is not null ? $"{match.Exchange}|{match.TradingSymbol}" : null;
    }
}
