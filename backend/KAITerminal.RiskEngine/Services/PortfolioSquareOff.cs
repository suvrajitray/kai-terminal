using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Notifications;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using Microsoft.Extensions.Logging;

namespace KAITerminal.RiskEngine.Services;

/// <summary>
/// Squares off all open positions for a user, sells-first to release margin before
/// covering longs. Always re-fetches positions from the broker so manual closes are
/// honoured. Marks the user as squared-off and notifies on completion or failure.
/// </summary>
public sealed class PortfolioSquareOff
{
    private readonly IRiskRepository                _repo;
    private readonly IRiskEventNotifier             _notifier;
    private readonly ILogger<PortfolioSquareOff>    _logger;

    public PortfolioSquareOff(
        IRiskRepository              repo,
        IRiskEventNotifier           notifier,
        ILogger<PortfolioSquareOff>  logger)
    {
        _repo     = repo;
        _notifier = notifier;
        _logger   = logger;
    }

    public async Task ExecuteAsync(
        string         userId,
        string         brokerType,
        string         stateKey,
        decimal        mtm,
        IBrokerClient  broker,
        UserConfig     config,
        CancellationToken ct)
    {
        try
        {
            var fresh    = await broker.GetAllPositionsAsync(ct);
            var toExit   = BuildExitPlan(fresh, config.WatchedProducts);
            var excluded = fresh.Count(p => p.IsOpen && !ProductTypeFilter.Matches(p.Product, config.WatchedProducts));

            LogPlan(userId, brokerType, config, toExit.Count, fresh.Count, excluded);

            foreach (var pos in toExit)
            {
                _logger.LogInformation(
                    "[EXIT ] {Direction} {Token}  qty={Qty}  product={Product}  [{Broker} / {UserId}]",
                    pos.Quantity < 0 ? "SHORT" : "LONG", pos.InstrumentToken, Math.Abs(pos.Quantity),
                    pos.Product, brokerType, userId);
                await broker.ExitPositionAsync(pos.InstrumentToken, pos.Product, ct);
            }

            await _repo.MutateAsync(stateKey, s => s.IsSquaredOff = true);

            if (toExit.Count > 0)
            {
                _logger.LogWarning(
                    "[EXIT ] Complete — {UserId} ({Broker})  |  {Count} exited  [{Filter}]",
                    userId, brokerType, toExit.Count, config.WatchedProducts);
                await _notifier.NotifyAsync(new RiskNotification(
                    userId, brokerType, RiskNotificationType.SquareOffComplete,
                    mtm, Timestamp: DateTimeOffset.UtcNow), ct);
            }
            else
            {
                _logger.LogWarning(
                    "[EXIT ] Skipped — {UserId} ({Broker})  |  no open [{Filter}] positions  (already closed manually)",
                    userId, brokerType, config.WatchedProducts);
            }
        }
        catch (Exception ex)
        {
            await _repo.MutateAsync(stateKey, s => s.IsSquaredOff = true);
            _logger.LogError(ex,
                "[EXIT ] FAILED — {UserId} ({Broker}) — marked squared-off; manual verification required",
                userId, brokerType);
            await _notifier.NotifyAsync(new RiskNotification(
                userId, brokerType, RiskNotificationType.SquareOffFailed,
                mtm, Timestamp: DateTimeOffset.UtcNow), ct);
        }
    }

    private static List<BrokerPosition> BuildExitPlan(
        IReadOnlyList<BrokerPosition> positions, string watchedProducts) =>
        positions
            .Where(p => p.IsOpen && ProductTypeFilter.Matches(p.Product, watchedProducts))
            .OrderBy(p => p.Quantity < 0 ? 0 : 1) // sells first → releases margin
            .ToList();

    private void LogPlan(string userId, string brokerType, UserConfig config,
        int toExitCount, int total, int excluded)
    {
        if (toExitCount == 0)
            _logger.LogWarning(
                "[EXIT ] Square-off — {UserId} ({Broker})  |  filter={Filter}  |  no open positions  (already closed?)  |  total={Total} excluded={Excluded}",
                userId, brokerType, config.WatchedProducts, total, excluded);
        else
            _logger.LogWarning(
                "[EXIT ] Square-off — {UserId} ({Broker})  |  filter={Filter}  |  {Count} to exit (sells first)  |  total={Total} excluded={Excluded}",
                userId, brokerType, config.WatchedProducts, toExitCount, total, excluded);
    }
}
