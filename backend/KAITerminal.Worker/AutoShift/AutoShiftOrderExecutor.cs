using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Notifications;
using KAITerminal.MarketData.Models;
using KAITerminal.MarketData.Services;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker;

/// <summary>
/// Executes auto-shift orders: close existing position → wait for fill → open new position.
/// Also handles exhausted-position exits.
/// </summary>
internal sealed class AutoShiftOrderExecutor
{
    private readonly OptionStrikeService _strikeSvc;
    private readonly IRiskRepository             _repo;
    private readonly IRiskEventNotifier          _notifier;
    private readonly IPositionCache              _cache;
    // Func<T> breaks the circular DI dependency — resolved lazily on first use.
    private readonly Func<IPositionRefreshTrigger> _refreshTriggerFactory;
    private readonly ILogger<AutoShiftOrderExecutor> _logger;

    public AutoShiftOrderExecutor(
        OptionStrikeService strikeSvc,
        IRiskRepository                  repo,
        IRiskEventNotifier               notifier,
        IPositionCache                   cache,
        Func<IPositionRefreshTrigger>    refreshTriggerFactory,
        ILogger<AutoShiftOrderExecutor>  logger)
    {
        _strikeSvc             = strikeSvc;
        _repo                  = repo;
        _notifier              = notifier;
        _cache                 = cache;
        _refreshTriggerFactory = refreshTriggerFactory;
        _logger                = logger;
    }

    public async Task ShiftAsync(
        AutoShiftDecision decision, UserConfig config, IBrokerClient broker,
        string userId, string stateKey, IReadOnlyList<ZerodhaOptionContract> allContracts,
        CancellationToken ct)
    {
        var position  = decision.Position;
        var contract  = decision.Contract!;
        var chainKey  = decision.ChainKey!;
        var shiftCount = decision.ShiftCount;

        _logger.LogInformation(
            "AutoShift state — chain={ChainKey} shifts={ShiftCount}/{MaxShifts} isShiftedLeg={IsShifted} [{Broker} / {UserId}]",
            chainKey, shiftCount, config.AutoShiftMaxCount,
            decision.IsShiftedLeg,
            broker.BrokerType, userId);

        _logger.LogWarning(
            "AutoShift SHIFTING — chain={ChainKey} current strike={Strike} moving {Gap} strike(s) OTM [{Broker} / {UserId}]",
            chainKey, contract.Strike, config.AutoShiftStrikeGap, broker.BrokerType, userId);

        var newUpstoxKey = await _strikeSvc.FindByStrikeGapAsync(
            decision.UnderlyingKey!, contract.Expiry, contract.InstrumentType,
            contract.Strike, decision.StrikeGap, ct);

        if (newUpstoxKey is null)
        {
            _logger.LogWarning(
                "AutoShift — no target strike found for chain={ChainKey} gap={Gap} — skipping [{Broker} / {UserId}]",
                chainKey, decision.StrikeGap, broker.BrokerType, userId);
            return;
        }

        var (openSymbol, openExchange) = BuildOpenOrder(newUpstoxKey, broker.BrokerType, allContracts);

        if (openSymbol is null)
        {
            _logger.LogWarning(
                "AutoShift — could not resolve open token for upstoxKey={UpstoxKey} chain={ChainKey} ({Broker}) — skipping [{UserId}]",
                newUpstoxKey, chainKey, broker.BrokerType, userId);
            return;
        }

        var qty        = Math.Abs(position.Quantity);
        var closeOrder = new BrokerOrderRequest(position.InstrumentToken, qty, "BUY",  position.Product, "MARKET", Exchange: position.Exchange);
        var openOrder  = new BrokerOrderRequest(openSymbol,               qty, "SELL", position.Product, "MARKET", Exchange: openExchange);

        _logger.LogInformation(
            "AutoShift placing orders — chain={ChainKey} shift {From}→{To} | close={CloseSymbol} qty={Qty} | open={OpenSymbol} qty={Qty} [{Broker} / {UserId}]",
            chainKey, shiftCount, shiftCount + 1, position.InstrumentToken, qty, openSymbol, qty, broker.BrokerType, userId);

        string closeOrderId;
        try
        {
            closeOrderId = await broker.PlaceOrderAsync(closeOrder, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "AutoShift FAILED — could not place close order for {CloseSymbol} qty={Qty} chain={ChainKey} [{Broker} / {UserId}]",
                position.InstrumentToken, qty, chainKey, broker.BrokerType, userId);
            await _notifier.NotifyAsync(new RiskNotification(
                UserId:          userId,
                Broker:          broker.BrokerType,
                Type:            RiskNotificationType.AutoShiftFailed,
                Mtm:             _cache.GetMtm(stateKey),
                InstrumentToken: position.InstrumentToken,
                Timestamp:       DateTimeOffset.UtcNow), ct);
            throw;
        }
        _logger.LogInformation(
            "AutoShift close order placed — {CloseSymbol} qty={Qty} orderId={OrderId} [{Broker} / {UserId}]",
            position.InstrumentToken, qty, closeOrderId, broker.BrokerType, userId);

        // Mark the old token so subsequent LTP ticks don't re-trigger a second shift before
        // the next poll.
        _cache.MarkShifted(stateKey, position.InstrumentToken);

        // Capture locals for the fire-and-forget task
        var capturedOpenSymbol = openSymbol;
        var capturedChainKey   = chainKey;
        var capturedContract   = contract;

        // Fire-and-forget: wait for the close order to actually fill, then open the new short.
        _ = Task.Run(async () =>
        {
            try
            {
                await FillPoller.WaitForFillAsync(broker, closeOrderId, timeoutSeconds: 15, userId, capturedChainKey, _logger);

                await broker.PlaceOrderAsync(openOrder, CancellationToken.None);
                _logger.LogInformation(
                    "AutoShift open order placed — {OpenSymbol} qty={Qty} [{Broker} / {UserId}]",
                    capturedOpenSymbol, qty, broker.BrokerType, userId);

                // Fetch fresh state — other evaluations may have run while we waited.
                var freshState = await _repo.GetOrCreateAsync(stateKey);
                var newCount   = freshState.IncrementAutoShiftCount(capturedChainKey);
                freshState.MapShiftOrigin(capturedOpenSymbol, capturedChainKey);
                await _repo.UpdateAsync(stateKey, freshState);

                _logger.LogInformation(
                    "AutoShift COMPLETE — chain={ChainKey} shift {NewCount}/{MaxCount} done | {OldStrike}→{OpenSymbol} | remaining shifts={Remaining} [{Broker} / {UserId}]",
                    capturedChainKey, newCount, config.AutoShiftMaxCount, capturedContract.Strike, capturedOpenSymbol,
                    config.AutoShiftMaxCount - newCount, broker.BrokerType, userId);

                // Trigger an immediate position poll so the new leg is subscribed to the LTP feed.
                await Task.Delay(500);
                _refreshTriggerFactory().RequestRefresh(stateKey);

                await _notifier.NotifyAsync(new RiskNotification(
                    UserId:          userId,
                    Broker:          broker.BrokerType,
                    Type:            RiskNotificationType.AutoShiftTriggered,
                    Mtm:             _cache.GetMtm(stateKey),
                    InstrumentToken: position.InstrumentToken,
                    NewToken:        capturedOpenSymbol,
                    ShiftCount:      newCount,
                    Timestamp:       DateTimeOffset.UtcNow), CancellationToken.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "AutoShift PARTIAL FAILURE — close={CloseSymbol} succeeded but open={OpenSymbol} FAILED for chain={ChainKey} [{Broker} / {UserId}]. Manual intervention required.",
                    position.InstrumentToken, capturedOpenSymbol, capturedChainKey, broker.BrokerType, userId);
                try
                {
                    await _notifier.NotifyAsync(new RiskNotification(
                        UserId:          userId,
                        Broker:          broker.BrokerType,
                        Type:            RiskNotificationType.AutoShiftFailed,
                        Mtm:             _cache.GetMtm(stateKey),
                        InstrumentToken: position.InstrumentToken,
                        Timestamp:       DateTimeOffset.UtcNow), CancellationToken.None);
                }
                catch { /* best-effort */ }
            }
        });
    }

    public async Task ExitExhaustedAsync(
        AutoShiftDecision decision, IBrokerClient broker,
        UserRiskState state, string userId, string stateKey, CancellationToken ct)
    {
        var position  = decision.Position;
        var chainKey  = decision.ChainKey!;
        var shiftCount = decision.ShiftCount;

        _logger.LogWarning(
            "AutoShift EXHAUSTED — {UserId} ({Broker}) | token={Token} has used all {MaxCount} shift(s) — placing exit order now",
            userId, broker.BrokerType, position.InstrumentToken, decision.MaxShiftCount);

        await broker.ExitPositionAsync(position.InstrumentToken, position.Product, ct);

        _logger.LogInformation(
            "AutoShift EXHAUSTED exit order placed — {Token} exited after {Count}/{MaxCount} shift(s) [{Broker} / {UserId}]",
            position.InstrumentToken, shiftCount, decision.MaxShiftCount, broker.BrokerType, userId);

        // Mark this token so subsequent LTP ticks don't re-trigger before the next poll.
        _cache.MarkShifted(stateKey, position.InstrumentToken);

        // Also mark chain exited to guard against duplicate exhausted-exit orders.
        state.MarkChainExited(chainKey);
        await _repo.UpdateAsync(stateKey, state);
        _logger.LogInformation(
            "AutoShift EXHAUSTED chain={ChainKey} marked exited — duplicate exits suppressed [{Broker} / {UserId}]",
            chainKey, broker.BrokerType, userId);

        // Trigger an immediate position poll (~500 ms delay for fill propagation).
        _ = Task.Run(async () =>
        {
            await Task.Delay(500);
            _refreshTriggerFactory().RequestRefresh(stateKey);
        });

        await _notifier.NotifyAsync(new RiskNotification(
            UserId:          userId,
            Broker:          broker.BrokerType,
            Type:            RiskNotificationType.AutoShiftExhausted,
            Mtm:             _cache.GetMtm(stateKey),
            InstrumentToken: position.InstrumentToken,
            ShiftCount:      shiftCount,
            Timestamp:       DateTimeOffset.UtcNow), ct);
    }

    /// <summary>
    /// Resolves the open order (symbol + exchange) for a shift.
    /// Upstox: returns the Upstox instrument key with no exchange (it's encoded in the key).
    /// Zerodha: looks up the TradingSymbol and Exchange from the Kite contract list.
    /// </summary>
    private static (string? symbol, string? exchange) BuildOpenOrder(
        string upstoxKey, string brokerType,
        IReadOnlyList<ZerodhaOptionContract> contracts)
    {
        if (string.Equals(brokerType, BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
            return (upstoxKey, null);

        // Zerodha: derive exchange_token from the Upstox key, look up the trading symbol + exchange
        var exchangeToken = upstoxKey.Contains('|') ? upstoxKey.Split('|')[1] : upstoxKey;
        var match = contracts.FirstOrDefault(c =>
            c.ExchangeToken.Equals(exchangeToken, StringComparison.OrdinalIgnoreCase));

        return match is not null ? (match.TradingSymbol, match.Exchange) : (null, null);
    }
}
