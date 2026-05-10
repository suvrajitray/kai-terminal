using KAITerminal.MarketData.Extensions;
using KAITerminal.RollingStraddle.Configuration;
using KAITerminal.RollingStraddle.Services;
using KAITerminal.Upstox.Extensions;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var overrides = new List<KeyValuePair<string, string?>>();

    Prompt("Upstox access token (Enter to use appsettings value): ",
        v => overrides.Add(new("Upstox:AccessToken", v)));

    Prompt("Expiry yyyy-MM-dd (Enter to use appsettings value): ",
        v => overrides.Add(new("Strategy:Expiry", v)));

    Prompt("Lots (Enter to use appsettings value): ",
        v => overrides.Add(new("Strategy:Lots", v)));

    Prompt("Daily MTM target ₹ (Enter to use appsettings value): ",
        v => overrides.Add(new("Strategy:DailyMtmTarget", v)));

    Prompt("Daily MTM stop-loss ₹ (Enter to use appsettings value): ",
        v => overrides.Add(new("Strategy:DailyMtmStopLoss", v)));

    var builder = Host.CreateApplicationBuilder(args);
    if (overrides.Count > 0)
        builder.Configuration.AddInMemoryCollection(overrides);

    Log.Logger = new LoggerConfiguration()
        .ReadFrom.Configuration(builder.Configuration)
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

static void Prompt(string label, Action<string> onValue)
{
    Console.Write(label);
    var value = Console.ReadLine()?.Trim() ?? string.Empty;
    if (!string.IsNullOrEmpty(value))
        onValue(value);
}
