using System.Threading.Channels;
using KAITerminal.RiskEngine.Risk;

namespace KAITerminal.RiskEngine.Workers;

public class TickRiskWorker : BackgroundService
{
  private readonly Channel<string> _channel =
      Channel.CreateUnbounded<string>();

  private readonly StrikeMonitor _monitor;
  private readonly ILogger<TickRiskWorker> _logger;

  public TickRiskWorker(
      StrikeMonitor monitor,
      ILogger<TickRiskWorker> logger)
  {
    _monitor = monitor;
    _logger = logger;
  }

  public void Enqueue(string strategyId)
  {
    _channel.Writer.TryWrite(strategyId);
  }

  protected override async Task ExecuteAsync(CancellationToken ct)
  {
    _logger.LogInformation("TickRiskWorker started");
    return; // temporarily disabled to test background worker and logging. Will re-enable after testing.
    /*
    await foreach (var strategyId in _channel.Reader.ReadAllAsync(ct))
    {
      try
      {
        await _monitor.EvaluateTickAsync(strategyId);
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Tick risk error");
      }
    }
    */
  }
}
