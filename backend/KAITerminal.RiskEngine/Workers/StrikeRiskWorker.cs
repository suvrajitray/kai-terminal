using KAITerminal.Broker.Upstox;
using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Risk;
using KAITerminal.Types;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Workers;

public class StrikeRiskWorker(
    StrikeMonitor monitor,
    IStrategyProvider strategies,
    IOptions<UpstoxSettings> upstoxSettings,
    ILogger<StrikeRiskWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        logger.LogInformation("StrikeRiskWorker started");
        while (!ct.IsCancellationRequested)
        {
            var token = new AccessToken(upstoxSettings.Value.AccessToken);
            var ids = await strategies.GetActiveStrategiesAsync();
            foreach (var id in ids)
            {
                try { await monitor.EvaluateTickAsync(token, id); }
                catch (Exception ex) { logger.LogError(ex, "Strike risk error for {Id}", id); }
            }
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }
}
