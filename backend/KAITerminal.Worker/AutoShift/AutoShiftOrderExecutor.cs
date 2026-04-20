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
    private readonly OptionStrikeService              _strikeSvc;
    private readonly IRiskRepository                  _repo;
    private readonly IRiskEventNotifier               _notifier;
    private readonly IPositionCache                   _cache;
    // Func<T> breaks the circular DI dependency — resolved lazily on first use.
    private readonly Func<IPositionRefreshTrigger>    _refreshTriggerFactory;
    private readonly ILogger<AutoShiftOrderExecutor>  _logger;

    /// <summary>All context needed to complete the open leg after the close fill arrives.</summary>
    private sealed record ShiftCompletion(
        string             CloseToken,
        string             CloseOrderId,
        BrokerOrderRequest OpenOrder,
        string             OpenSymbol,
        string             ChainKey,
        decimal            OriginalStrike,
        int                MaxShiftCount,
        string             StateKey,
        string             UserId,
        int                Qty);

    public AutoShiftOrderExecutor(
        OptionStrikeService               strikeSvc,
        IRiskRepository                   repo,
        IRiskEventNotifier                notifier,
        IPositionCache                    cache,
        Func<IPositionRefreshTrigger>     refreshTriggerFactory,
        ILogger<AutoShiftOrderExecutor>   logger)
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

        _logger.LogWarning(
            "AutoShift SHIFTING — chain={ChainKey} shift {ShiftCount}/{MaxShifts} | strike={Strike} moving {Gap} OTM | isShiftedLeg={IsShifted} [{Broker} / {UserId}]",
            chainKey, decision.ShiftCount + 1, config.AutoShiftMaxCount, contract.Strike,
            config.AutoShiftStrikeGap, decision.IsShiftedLeg, broker.BrokerType, userId);

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
            "AutoShift placing orders — chain={ChainKey} shift {From}→{To} | close={CloseSymbol} qty={Qty} exch={CloseExch} | open={OpenSymbol} qty={Qty} exch={OpenExch} [{Broker} / {UserId}]",
            chainKey, decision.ShiftCount, decision.ShiftCount + 1,
            position.InstrumentToken, qty, position.Exchange ?? "N/A",
            openSymbol, qty, openExchange ?? "N/A",
            broker.BrokerType, userId);

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

        // Mark the old token so subsequent LTP ticks don't re-trigger a second shift before the next poll.
        _cache.MarkShifted(stateKey, position.InstrumentToken);

        // Fire-and-forget: wait for the close fill then open the new short.
        // CancellationToken.None is intentional — the close order is already sent to the
        // exchange, so we must complete the open leg even if the session is cancelled.
        var completion = new ShiftCompletion(
            CloseToken:     position.InstrumentToken,
            CloseOrderId:   closeOrderId,
            OpenOrder:      openOrder,
            OpenSymbol:     openSymbol,
            ChainKey:       chainKey,
            OriginalStrike: contract.Strike,
            MaxShiftCount:  config.AutoShiftMaxCount,
            StateKey:       stateKey,
            UserId:         userId,
            Qty:            qty);

        _ = Task.Run(async () =>
        {
            try   { await CompleteShiftAsync(completion, broker); }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "AutoShift background task CRASHED — chain={ChainKey} close={CloseToken} open={OpenSymbol} [{Broker} / {UserId}]. Manual intervention required.",
                    completion.ChainKey, completion.CloseToken, completion.OpenSymbol,
                    broker.BrokerType, completion.UserId);
            }
        });
    }

    /// <summary>
    /// Runs fire-and-forget after the close order is placed: polls for fill, opens the new
    /// short, commits shift state, and notifies. Uses <see cref="CancellationToken.None"/>
    /// throughout — the close is already at the exchange and must be paired.
    /// </summary>
    private async Task CompleteShiftAsync(ShiftCompletion ctx, IBrokerClient broker)
    {
        try
        {
            await FillPoller.WaitForFillAsync(broker, ctx.CloseOrderId, timeoutSeconds: 15,
                ctx.UserId, ctx.ChainKey, _logger, CancellationToken.None);

            await broker.PlaceOrderAsync(ctx.OpenOrder, CancellationToken.None);
            _logger.LogInformation(
                "AutoShift open order placed — {OpenSymbol} qty={Qty} [{Broker} / {UserId}]",
                ctx.OpenSymbol, ctx.Qty, broker.BrokerType, ctx.UserId);

            // MutateAsync serialises Dictionary writes against concurrent session-loop reads.
            int newCount = 0;
            await _repo.MutateAsync(ctx.StateKey, s =>
            {
                newCount = s.IncrementAutoShiftCount(ctx.ChainKey);
                s.MapShiftOrigin(ctx.OpenSymbol, ctx.ChainKey);
            });

            _logger.LogInformation(
                "AutoShift COMPLETE — chain={ChainKey} shift {NewCount}/{MaxCount} done | strike {OldStrike}→{OpenSymbol} | remaining={Remaining} [{Broker} / {UserId}]",
                ctx.ChainKey, newCount, ctx.MaxShiftCount, ctx.OriginalStrike, ctx.OpenSymbol,
                ctx.MaxShiftCount - newCount, broker.BrokerType, ctx.UserId);

            // Brief delay for fill propagation, then wake the position poller.
            await Task.Delay(500);
            _refreshTriggerFactory().RequestRefresh(ctx.StateKey);

            await _notifier.NotifyAsync(new RiskNotification(
                UserId:          ctx.UserId,
                Broker:          broker.BrokerType,
                Type:            RiskNotificationType.AutoShiftTriggered,
                Mtm:             _cache.GetMtm(ctx.StateKey),
                InstrumentToken: ctx.CloseToken,
                NewToken:        ctx.OpenSymbol,
                ShiftCount:      newCount,
                Timestamp:       DateTimeOffset.UtcNow), CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "AutoShift PARTIAL FAILURE — close={CloseToken} succeeded but open={OpenSymbol} FAILED for chain={ChainKey} [{Broker} / {UserId}]. Manual intervention required.",
                ctx.CloseToken, ctx.OpenSymbol, ctx.ChainKey, broker.BrokerType, ctx.UserId);
            try
            {
                await _notifier.NotifyAsync(new RiskNotification(
                    UserId:          ctx.UserId,
                    Broker:          broker.BrokerType,
                    Type:            RiskNotificationType.AutoShiftFailed,
                    Mtm:             _cache.GetMtm(ctx.StateKey),
                    InstrumentToken: ctx.CloseToken,
                    Timestamp:       DateTimeOffset.UtcNow), CancellationToken.None);
            }
            catch { /* best-effort */ }
        }
    }

    public async Task ExitExhaustedAsync(
        AutoShiftDecision decision, IBrokerClient broker,
        string userId, string stateKey, CancellationToken ct)
    {
        var position  = decision.Position;
        var chainKey  = decision.ChainKey!;

        _logger.LogWarning(
            "AutoShift EXHAUSTED — {UserId} ({Broker}) | token={Token} has used all {MaxCount} shift(s) — placing exit order now",
            userId, broker.BrokerType, position.InstrumentToken, decision.MaxShiftCount);

        await broker.ExitPositionAsync(position.InstrumentToken, position.Product, ct);

        _logger.LogInformation(
            "AutoShift EXHAUSTED exit order placed — {Token} exited after {Count}/{MaxCount} shift(s) [{Broker} / {UserId}]",
            position.InstrumentToken, decision.ShiftCount, decision.MaxShiftCount, broker.BrokerType, userId);

        // Mark this token so subsequent LTP ticks don't re-trigger before the next poll.
        _cache.MarkShifted(stateKey, position.InstrumentToken);

        // MutateAsync serialises HashSet write against concurrent session-loop reads.
        await _repo.MutateAsync(stateKey, s => s.MarkChainExited(chainKey));
        _logger.LogDebug(
            "AutoShift EXHAUSTED chain={ChainKey} marked exited — duplicate exits suppressed [{Broker} / {UserId}]",
            chainKey, broker.BrokerType, userId);

        // Brief delay for fill propagation, then wake the position poller.
        await Task.Delay(500, ct);
        _refreshTriggerFactory().RequestRefresh(stateKey);

        await _notifier.NotifyAsync(new RiskNotification(
            UserId:          userId,
            Broker:          broker.BrokerType,
            Type:            RiskNotificationType.AutoShiftExhausted,
            Mtm:             _cache.GetMtm(stateKey),
            InstrumentToken: position.InstrumentToken,
            ShiftCount:      decision.ShiftCount,
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

        var exchangeToken = upstoxKey.Contains('|') ? upstoxKey.Split('|')[1] : upstoxKey;
        var match = contracts.FirstOrDefault(c =>
            c.ExchangeToken.Equals(exchangeToken, StringComparison.OrdinalIgnoreCase));

        return match is not null ? (match.TradingSymbol, match.Exchange) : (null, null);
    }
}
