// Auto Activate Strategy on Startup
using KAITerminal.RiskEngine.Interfaces;

namespace KAITerminal.RiskEngine.Workers;

public class StartupSeeder : IHostedService
{
  private readonly IStrategyProvider _strategies;
  private readonly ILogger<StartupSeeder> _logger;

  public StartupSeeder(
      IStrategyProvider strategies,
      ILogger<StartupSeeder> logger)
  {
    _strategies = strategies;
    _logger = logger;
  }

  public async Task StartAsync(CancellationToken cancellationToken)
  {
    const string strategyId = "TEST_STRATEGY_1";

    await _strategies.ActivateAsync(strategyId);

    _logger.LogInformation("Activated strategy {id}", strategyId);
  }

  public Task StopAsync(CancellationToken cancellationToken)
      => Task.CompletedTask;
}
