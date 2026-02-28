using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Risk;

namespace KAITerminal.RiskEngine.Workers;

public class RiskBackgroundWorker : BackgroundService
{
  private readonly RiskEvaluator _evaluator;
  private readonly IStrategyProvider _strategies;
  private readonly ILogger<RiskBackgroundWorker> _logger;

  public RiskBackgroundWorker(
      RiskEvaluator evaluator,
      IStrategyProvider strategies,
      ILogger<RiskBackgroundWorker> logger)
  {
    _evaluator = evaluator;
    _strategies = strategies;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken ct)
  {
    _logger.LogInformation("RiskBackgroundWorker started");

    while (!ct.IsCancellationRequested)
    {
      try
      {
        var ids = await _strategies.GetActiveStrategiesAsync();

        foreach (var id in ids)
        {
          await _evaluator.EvaluateAsync(id);
        }
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Risk evaluation error");
      }

      await Task.Delay(TimeSpan.FromSeconds(60), ct);
    }
  }
}
