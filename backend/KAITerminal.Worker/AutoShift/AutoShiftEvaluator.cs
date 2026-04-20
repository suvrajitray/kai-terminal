using KAITerminal.Broker;
using KAITerminal.Contracts.Notifications;
using KAITerminal.MarketData.Services;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;

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
    private readonly IZerodhaInstrumentService   _zerodhaInstruments;
    private readonly IRiskRepository             _repo;
    private readonly IRiskEventNotifier          _notifier;
    private readonly IPositionCache              _cache;
    private readonly AutoShiftOrderExecutor      _executor;
    private readonly ILogger<AutoShiftEvaluator> _logger;

    public AutoShiftEvaluator(
        IZerodhaInstrumentService         zerodhaInstruments,
        IRiskRepository                   repo,
        IRiskEventNotifier                notifier,
        IPositionCache                    cache,
        AutoShiftOrderExecutor            executor,
        ILogger<AutoShiftEvaluator>       logger)
    {
        _zerodhaInstruments = zerodhaInstruments;
        _repo               = repo;
        _notifier           = notifier;
        _cache              = cache;
        _executor           = executor;
        _logger             = logger;
    }

    public async Task EvaluateAsync(UserConfig config, IBrokerClient broker, CancellationToken ct)
    {
        if (!config.AutoShiftEnabled)
            return;

        var userId = config.UserId;
        try
        {
            await EvaluateCoreAsync(config, broker, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "AutoShift evaluation FAILED — {UserId} ({Broker})",
                userId, broker.BrokerType);
            try
            {
                await _notifier.NotifyAsync(new RiskNotification(
                    UserId:    userId,
                    Broker:    broker.BrokerType,
                    Type:      RiskNotificationType.AutoShiftFailed,
                    Mtm:       _cache.GetMtm($"{userId}::{config.BrokerType}"),
                    Timestamp: DateTimeOffset.UtcNow), ct);
            }
            catch (Exception notifyEx)
            {
                _logger.LogWarning(notifyEx,
                    "Failed to notify frontend of AutoShift failure — {UserId} ({Broker}) — check API health",
                    userId, broker.BrokerType);
            }
        }
    }

    private async Task EvaluateCoreAsync(UserConfig config, IBrokerClient broker, CancellationToken ct)
    {
        var userId   = config.UserId;
        var stateKey = $"{userId}::{config.BrokerType}";
        var state    = await _repo.ReadAsync(stateKey, s => s.ToSnapshot());
        if (state.IsSquaredOff)
            return;

        var sellPositions = _cache.GetPositions(stateKey).Where(p => p.Quantity < 0).ToList();
        if (sellPositions.Count == 0)
            return;

        _logger.LogDebug(
            "AutoShift tick — {UserId} ({Broker}) evaluating {Count} sell position(s)",
            userId, broker.BrokerType, sellPositions.Count);

        var crossings = AutoShiftDecisionEngine.FilterThresholdCrossings(
            sellPositions,
            token => _cache.TryGetLiveLtp(stateKey, token),
            token => _cache.IsShifted(stateKey, token),
            config);

        if (crossings.Count == 0)
            return;

        // Lazy-load contracts — only when at least one position crossed threshold
        var allContracts = await _zerodhaInstruments.GetAllCurrentYearContractsAsync(ct);

        var decisions = AutoShiftDecisionEngine.Evaluate(
            crossings, state, config, allContracts, broker.BrokerType);

        foreach (var decision in decisions)
        {
            switch (decision.Kind)
            {
                case AutoShiftDecisionKind.SkipContractNotFound:
                    _logger.LogWarning(
                        "AutoShift — no contract found for token {Token} [{Broker} / {UserId}] — skipping",
                        decision.Position.InstrumentToken, broker.BrokerType, userId);
                    await _notifier.NotifyAsync(new RiskNotification(
                        UserId:          userId,
                        Broker:          broker.BrokerType,
                        Type:            RiskNotificationType.AutoShiftFailed,
                        Mtm:             _cache.GetMtm(stateKey),
                        InstrumentToken: decision.Position.InstrumentToken,
                        Timestamp:       DateTimeOffset.UtcNow), ct);
                    break;

                case AutoShiftDecisionKind.SkipUnknownUnderlying:
                    _logger.LogWarning(
                        "AutoShift — unknown underlying '{Name}' for chain {ChainKey} — skipping [{Broker} / {UserId}]",
                        decision.Contract!.Name, decision.ChainKey, broker.BrokerType, userId);
                    break;

                case AutoShiftDecisionKind.ExitExhausted:
                    await _executor.ExitExhaustedAsync(decision, broker, userId, stateKey, ct);
                    break;

                case AutoShiftDecisionKind.Shift:
                    await _executor.ShiftAsync(decision, config, broker, userId, stateKey, allContracts, ct);
                    break;
            }
        }
    }
}
