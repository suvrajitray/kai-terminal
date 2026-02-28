namespace KAITerminal.RiskEngine.Workers;

public class DummyTickGenerator : BackgroundService
{
  private readonly KAITerminal.RiskEngine.Brokers.Upstox.UpstoxTickWebSocket _ws;
  private readonly ILogger<DummyTickGenerator> _logger;

  public DummyTickGenerator(
      KAITerminal.RiskEngine.Brokers.Upstox.UpstoxTickWebSocket ws,
      ILogger<DummyTickGenerator> logger)
  {
    _ws = ws;
    _logger = logger;
  }

  protected override async Task ExecuteAsync(CancellationToken ct)
  {
    _logger.LogInformation("Dummy tick generator started");

    decimal price = 100;

    while (!ct.IsCancellationRequested)
    {
      // simulate price spike
      price += Random.Shared.Next(-5, 15);

      await _ws.OnTickAsync("NIFTY24FEB22000CE", price);

      await Task.Delay(500, ct); // 2 ticks/sec
    }
  }
}
