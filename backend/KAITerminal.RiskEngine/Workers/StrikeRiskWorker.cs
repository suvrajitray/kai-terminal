using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Services;
using KAITerminal.Upstox;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Workers;

/// <summary>
/// Background worker that runs per-strike CE/PE stop-loss checks every
/// <see cref="RiskEngineConfig.StrikeCheckIntervalSeconds"/> seconds for all users.
/// </summary>
public sealed class StrikeRiskWorker : BackgroundService
{
    private readonly IUserTokenSource _tokenSource;
    private readonly StrikeMonitor _monitor;
    private readonly RiskEngineConfig _cfg;
    private readonly ILogger<StrikeRiskWorker> _logger;

    public StrikeRiskWorker(
        IUserTokenSource tokenSource,
        StrikeMonitor monitor,
        IOptions<RiskEngineConfig> cfg,
        ILogger<StrikeRiskWorker> logger)
    {
        _tokenSource = tokenSource;
        _monitor = monitor;
        _cfg = cfg.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("StrikeRiskWorker started (interval={Interval}s)", _cfg.StrikeCheckIntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            var users = _tokenSource.GetUsers();

            foreach (var user in users)
            {
                if (stoppingToken.IsCancellationRequested) break;
                try
                {
                    using (UpstoxTokenContext.Use(user.AccessToken))
                    {
                        await _monitor.MonitorAsync(user.UserId, stoppingToken);
                    }
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unhandled error in strike check for userId={UserId}", user.UserId);
                }
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(_cfg.StrikeCheckIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("StrikeRiskWorker stopped");
    }
}
