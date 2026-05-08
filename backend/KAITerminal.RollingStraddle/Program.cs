using KAITerminal.MarketData.Extensions;
using KAITerminal.RollingStraddle.Configuration;
using KAITerminal.RollingStraddle.Services;
using KAITerminal.Upstox.Extensions;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.SystemConsole.Themes;

const string OutputTemplate =
    "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}";

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(theme: AnsiConsoleTheme.Code, outputTemplate: OutputTemplate)
    .CreateBootstrapLogger();

try
{
    var builder = Host.CreateApplicationBuilder(args);

    Log.Logger = new LoggerConfiguration()
        .MinimumLevel.Information()
        .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
        .MinimumLevel.Override("System", LogEventLevel.Warning)
        .WriteTo.Console(theme: AnsiConsoleTheme.Code, outputTemplate: OutputTemplate)
        .Enrich.FromLogContext()
        .CreateLogger();

    builder.Services.AddSerilog(Log.Logger, dispose: true);
    builder.Services.AddUpstoxSdk(builder.Configuration);
    builder.Services.AddMarketDataCore(builder.Configuration);

    builder.Services.Configure<StrategyConfig>(
        builder.Configuration.GetSection(StrategyConfig.SectionName));

    builder.Services.AddSingleton<MarketDataFeed>();
    builder.Services.AddSingleton<OrderExecutor>();
    builder.Services.AddSingleton<PositionLedger>();
    builder.Services.AddHostedService<RollingStraddleRunner>();

    var host = builder.Build();

    using var startupCts = new CancellationTokenSource(TimeSpan.FromSeconds(60));
    try
    {
        await host.StartAsync(startupCts.Token);
    }
    catch (OperationCanceledException) when (startupCts.IsCancellationRequested)
    {
        Log.Fatal("Host did not start within 60 seconds");
        return 1;
    }

    await host.WaitForShutdownAsync();
    await host.StopAsync();
    return 0;
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
    return 1;
}
finally
{
    await Log.CloseAndFlushAsync();
}
