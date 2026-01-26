namespace KAITerminal.PnLWorker;

public class Worker(ILogger<Worker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        /*
        while (!stoppingToken.IsCancellationRequested)
        {
            if (logger.IsEnabled(LogLevel.Information))
            {
                logger.LogInformation("Worker running at: {time}", DateTimeOffset.Now);
            }
            await Task.Delay(1000, stoppingToken);
        }
        */

        /*
            Why PeriodicTimer?
            PeriodicTimer is better than Task.Delay because it doesn't "drift"
            If you used await Task.Delay(60000), the start time would slowly drift.
            Task.Delay scenario: Work takes 5 seconds + Delay 60 seconds = Loop runs every 65 seconds.
            PeriodicTimer scenario: Work takes 5 seconds + Timer waits 55 seconds = Loop runs every 60 seconds.
        */
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        logger.LogInformation("Service started. Waiting for next tick...");

        // 2. Loop continuously while the timer ticks
        // execution waits here until the minute is up
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                // This code runs exactly once per minute
                logger.LogInformation("Running scheduled task at: {time}", DateTimeOffset.Now);

                // --- YOUR LOGIC GOES HERE ---
                // e.g., await _myService.ProcessPendingEmails();
            }
            catch (Exception ex)
            {
                // Always catch exceptions in a background service,
                // otherwise the entire service (and loop) will crash.
                logger.LogError(ex, "An error occurred during the specific task.");
            }
        }
    }
}
