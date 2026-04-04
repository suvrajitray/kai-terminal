using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Options;
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

        var stateKey = $"{userId}::{config.BrokerType}";
        var state = await _repo.GetOrCreateAsync(stateKey);
        if (state.IsSquaredOff)
            return;

        var positions    = _cache.GetPositions(stateKey);
        var sellPositions = positions.Where(p => p.Quantity < 0).ToList();
        if (sellPositions.Count == 0)
            return;

        // Contracts are loaded lazily — only when at least one position crosses the threshold
        IReadOnlyList<ZerodhaOptionContract>? allContracts = null;

        _logger.LogDebug(
            "AutoShift tick — {UserId} ({Broker}) evaluating {Count} sell position(s)",
            userId, broker.BrokerType, sellPositions.Count);

        foreach (var position in sellPositions)
        {
            var ltp       = _cache.GetEffectiveLtp(stateKey, position.InstrumentToken, position.Ltp);
            var threshold = position.AveragePrice * (1 + config.AutoShiftThresholdPct / 100m);

            _logger.LogDebug(
                "AutoShift check — {Token} | avg={Avg:F2} threshold={Threshold:F2} ltp={Ltp:F2} ({Broker})",
                position.InstrumentToken, position.AveragePrice, threshold, ltp, broker.BrokerType);

            if (ltp < threshold)
                continue;

            _logger.LogInformation(
                "AutoShift TRIGGERED — {Token} ltp={Ltp:F2} crossed threshold={Threshold:F2} ({Pct}% above avg={Avg:F2}) [{Broker} / {UserId}]",
                position.InstrumentToken, ltp, threshold, config.AutoShiftThresholdPct, position.AveragePrice, broker.BrokerType, userId);

            allContracts ??= await _zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);

            var contract = LookupContract(position, broker.BrokerType, allContracts);
            if (contract is null)
            {
                _logger.LogWarning(
                    "AutoShift — no contract found for token {Token} ({Broker}) — skipping",
                    position.InstrumentToken, broker.BrokerType);
                continue;
            }

            // If this token was created by a previous shift, inherit the original leg's chain key
            // so the counter continues. Otherwise start a new key scoped to this specific strike,
            // giving each original position leg its own independent shift allowance.
            var isShiftedPosition = state.ShiftOriginMap.TryGetValue(position.InstrumentToken, out var mapped);
            var effectiveChainKey = isShiftedPosition
                ? mapped!
                : $"{contract.Name}_{contract.Expiry}_{contract.InstrumentType}_{contract.Strike}";

            var shiftCount = state.AutoShiftCounts.GetValueOrDefault(effectiveChainKey, 0);

            _logger.LogInformation(
                "AutoShift state — chain={ChainKey} shifts={ShiftCount}/{MaxShifts} isShiftedLeg={IsShifted} [{Broker} / {UserId}]",
                effectiveChainKey, shiftCount, config.AutoShiftMaxCount, isShiftedPosition, broker.BrokerType, userId);

            if (shiftCount >= config.AutoShiftMaxCount)
            {
                // Guard: skip if we already placed an exhausted-exit order this session.
                // The position stays in cache until the next poll; without this check the
                // same exit order would fire on every LTP tick until the cache refreshes.
                if (state.ExitedChainKeys.Contains(effectiveChainKey))
                {
                    _logger.LogDebug(
                        "AutoShift — chain={ChainKey} exhausted exit already placed, skipping [{Broker} / {UserId}]",
                        effectiveChainKey, broker.BrokerType, userId);
                    continue;
                }

                await ExitExhaustedPositionAsync(userId, stateKey, position, broker, state, effectiveChainKey, shiftCount, config.AutoShiftMaxCount, ct);
            }
            else
            {
                await ShiftPositionAsync(userId, stateKey, position, contract, effectiveChainKey, broker, state, config, ct);
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task ExitExhaustedPositionAsync(
        string userId, string stateKey, Contracts.Domain.BrokerPosition position, IBrokerClient broker,
        RiskEngine.Models.UserRiskState state, string chainKey, int shiftCount, int maxCount, CancellationToken ct)
    {
        var exitToken = BuildCloseToken(position, broker.BrokerType);

        _logger.LogWarning(
            "AutoShift EXHAUSTED — {UserId} ({Broker}) | token={Token} has used all {MaxCount} shift(s) — placing exit order now",
            userId, broker.BrokerType, exitToken, maxCount);

        await broker.ExitPositionAsync(exitToken, position.Product, ct);

        _logger.LogInformation(
            "AutoShift EXHAUSTED exit order placed — {Token} exited after {Count}/{MaxCount} shift(s) [{Broker} / {UserId}]",
            exitToken, shiftCount, maxCount, broker.BrokerType, userId);

        // Mark this chain as exited so repeated ticks don't fire another order
        // before the position poll removes the position from cache.
        state.MarkChainExited(chainKey);
        await _repo.UpdateAsync(stateKey, state);
        _logger.LogInformation(
            "AutoShift EXHAUSTED chain={ChainKey} marked exited — duplicate exits suppressed [{Broker} / {UserId}]",
            chainKey, broker.BrokerType, userId);

        await _notifier.NotifyAsync(new RiskNotification(
            UserId:          userId,
            Broker:          broker.BrokerType,
            Type:            RiskNotificationType.AutoShiftExhausted,
            Mtm:             _cache.GetMtm(stateKey),
            InstrumentToken: position.InstrumentToken,
            ShiftCount:      shiftCount,
            Timestamp:       DateTimeOffset.UtcNow), ct);
    }

    private async Task ShiftPositionAsync(
        string userId, string stateKey, Contracts.Domain.BrokerPosition position, ZerodhaOptionContract contract,
        string chainKey, IBrokerClient broker,
        RiskEngine.Models.UserRiskState state, UserConfig config, CancellationToken ct)
    {
        // CE seller: higher strike = further OTM → positive gap
        // PE seller: lower strike  = further OTM → negative gap
        var strikeGap = OptionInstrumentType.IsCe(contract.InstrumentType)
            ? config.AutoShiftStrikeGap
            : -config.AutoShiftStrikeGap;

        if (!UnderlyingKeys.TryGetValue(contract.Name, out var underlyingKey))
        {
            _logger.LogWarning(
                "AutoShift — unknown underlying '{Name}' for chain {ChainKey} — skipping [{Broker} / {UserId}]",
                contract.Name, chainKey, broker.BrokerType, userId);
            return;
        }

        _logger.LogInformation(
            "AutoShift SHIFTING — chain={ChainKey} current strike={Strike} moving {Gap} strike(s) OTM [{Broker} / {UserId}]",
            chainKey, contract.Strike, config.AutoShiftStrikeGap, broker.BrokerType, userId);

        var newUpstoxKey = await _strikeSvc.FindByStrikeGapAsync(
            underlyingKey, contract.Expiry, contract.InstrumentType,
            contract.Strike, strikeGap, ct);

        if (newUpstoxKey is null)
        {
            _logger.LogWarning(
                "AutoShift — no target strike found for chain={ChainKey} gap={Gap} — skipping [{Broker} / {UserId}]",
                chainKey, strikeGap, broker.BrokerType, userId);
            return;
        }

        var closeToken = BuildCloseToken(position, broker.BrokerType);
        var openToken  = BuildOpenToken(newUpstoxKey, broker.BrokerType,
            await _zerodhaInstruments.GetAllCurrentYearContractsAsync(ct));

        if (openToken is null)
        {
            _logger.LogWarning(
                "AutoShift — could not resolve open token for upstoxKey={UpstoxKey} chain={ChainKey} ({Broker}) — skipping [{UserId}]",
                newUpstoxKey, chainKey, broker.BrokerType, userId);
            return;
        }

        var qty        = Math.Abs(position.Quantity);
        var closeOrder = new BrokerOrderRequest(closeToken, qty, "BUY",  position.Product, "MARKET");
        var openOrder  = new BrokerOrderRequest(openToken,  qty, "SELL", position.Product, "MARKET");

        var currentCount = state.AutoShiftCounts.GetValueOrDefault(chainKey, 0);
        _logger.LogInformation(
            "AutoShift placing orders — chain={ChainKey} shift {From}→{To} | close={CloseToken} qty={Qty} | open={OpenToken} qty={Qty} [{Broker} / {UserId}]",
            chainKey, currentCount, currentCount + 1, closeToken, qty, openToken, qty, broker.BrokerType, userId);

        // Short: close first (releases margin) then open the new short
        await broker.PlaceOrderAsync(closeOrder, ct);
        _logger.LogInformation(
            "AutoShift close order placed — {CloseToken} qty={Qty} [{Broker} / {UserId}]",
            closeToken, qty, broker.BrokerType, userId);

        try
        {
            await broker.PlaceOrderAsync(openOrder, ct);
            _logger.LogInformation(
                "AutoShift open order placed — {OpenToken} qty={Qty} [{Broker} / {UserId}]",
                openToken, qty, broker.BrokerType, userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "AutoShift PARTIAL FAILURE — close={CloseToken} succeeded but open={OpenToken} FAILED for chain={ChainKey} [{Broker} / {UserId}]. Manual intervention required.",
                closeToken, openToken, chainKey, broker.BrokerType, userId);
            throw;
        }

        var newCount = state.IncrementAutoShiftCount(chainKey);
        // Map new token → original chain key so the counter is inherited on the next tick.
        // For Zerodha, openToken is "NFO|SYMBOL" but position.InstrumentToken is "SYMBOL" —
        // strip the exchange prefix so the map key matches what we look up on future ticks.
        var mapKey = string.Equals(broker.BrokerType, BrokerNames.Zerodha, StringComparison.OrdinalIgnoreCase)
                     && openToken.Contains('|')
            ? openToken.Split('|')[1]
            : openToken;
        state.MapShiftOrigin(mapKey, chainKey);
        await _repo.UpdateAsync(stateKey, state);

        _logger.LogInformation(
            "AutoShift COMPLETE — chain={ChainKey} shift {NewCount}/{MaxCount} done | {OldStrike}→{NewToken} | remaining shifts={Remaining} [{Broker} / {UserId}]",
            chainKey, newCount, config.AutoShiftMaxCount, contract.Strike, openToken,
            config.AutoShiftMaxCount - newCount, broker.BrokerType, userId);

        await _notifier.NotifyAsync(new RiskNotification(
            UserId:          userId,
            Broker:          broker.BrokerType,
            Type:            RiskNotificationType.AutoShiftTriggered,
            Mtm:             _cache.GetMtm(stateKey),
            InstrumentToken: position.InstrumentToken,
            NewToken:        openToken,
            ShiftCount:      newCount,
            Timestamp:       DateTimeOffset.UtcNow), ct);
    }

    private static ZerodhaOptionContract? LookupContract(
        Contracts.Domain.BrokerPosition position, string brokerType,
        IReadOnlyList<ZerodhaOptionContract> contracts)
    {
        if (string.Equals(brokerType, BrokerNames.Zerodha, StringComparison.OrdinalIgnoreCase))
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

    private static string BuildCloseToken(Contracts.Domain.BrokerPosition position, string brokerType)
    {
        if (string.Equals(brokerType, BrokerNames.Zerodha, StringComparison.OrdinalIgnoreCase))
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
        if (string.Equals(brokerType, BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
            return upstoxKey;

        // Zerodha: derive exchange_token from the Upstox key, look up the trading symbol
        var exchangeToken = upstoxKey.Contains('|') ? upstoxKey.Split('|')[1] : upstoxKey;
        var match = contracts.FirstOrDefault(c =>
            c.ExchangeToken.Equals(exchangeToken, StringComparison.OrdinalIgnoreCase));

        return match is not null ? $"{match.Exchange}|{match.TradingSymbol}" : null;
    }
}
