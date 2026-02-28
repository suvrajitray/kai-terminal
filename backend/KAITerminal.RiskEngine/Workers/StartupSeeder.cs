// Auto Activate Strategy on Startup
using KAITerminal.RiskEngine.Interfaces;

namespace KAITerminal.RiskEngine.Workers;

public class StartupSeeder : IHostedService
{
  private readonly IStrategyProvider _strategies;
  private readonly IConfiguration _config;
  private readonly ILogger<StartupSeeder> _logger;

  public StartupSeeder(
      IStrategyProvider strategies,
      IConfiguration config,
      ILogger<StartupSeeder> logger)
  {
    _strategies = strategies;
    _config = config;
    _logger = logger;
  }

  public async Task StartAsync(CancellationToken cancellationToken)
  {
    var ids = _config.GetSection("RiskEngine:Strategies").Get<string[]>()
              ?? ["DEFAULT_STRATEGY"];

    foreach (var id in ids)
    {
      await _strategies.ActivateAsync(id);
      _logger.LogInformation("Activated strategy {Id}", id);
    }
  }

  public Task StopAsync(CancellationToken cancellationToken)
      => Task.CompletedTask;
}
