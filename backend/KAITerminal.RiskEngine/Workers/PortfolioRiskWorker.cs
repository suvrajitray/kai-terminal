using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Configuration;
using KAITerminal.RiskEngine.Services;
using KAITerminal.Upstox;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace KAITerminal.RiskEngine.Workers;

/// <summary>
/// Background worker that runs the portfolio-level risk check every
/// <see cref="RiskEngineConfig.PortfolioCheckIntervalSeconds"/> seconds for all users.
/// </summary>
public sealed class PortfolioRiskWorker : BackgroundService
{
    private readonly IUserTokenSource _tokenSource;
    private readonly RiskEvaluator _evaluator;
    private readonly RiskEngineConfig _cfg;
    private readonly ILogger<PortfolioRiskWorker> _logger;

    public PortfolioRiskWorker(
        IUserTokenSource tokenSource,
        RiskEvaluator evaluator,
        IOptions<RiskEngineConfig> cfg,
        ILogger<PortfolioRiskWorker> logger)
    {
        _tokenSource = tokenSource;
        _evaluator = evaluator;
        _cfg = cfg.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PortfolioRiskWorker started (interval={Interval}s)", _cfg.PortfolioCheckIntervalSeconds);

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
                        await _evaluator.EvaluateAsync(user.UserId, stoppingToken);
                    }
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unhandled error in portfolio check for userId={UserId}", user.UserId);
                }
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(_cfg.PortfolioCheckIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("PortfolioRiskWorker stopped");
    }
}
