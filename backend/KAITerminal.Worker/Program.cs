using KAITerminal.Broker;
using KAITerminal.Util;
using KAITerminal.Contracts;
using Serilog;
using KAITerminal.Contracts.Notifications;
using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Infrastructure.Extensions;
using KAITerminal.MarketData.Extensions;
using KAITerminal.MarketData.Services;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Extensions;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Worker;
using KAITerminal.Worker.Mapping;
using KAITerminal.Worker.Notifications;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Extensions;

Log.Logger = new LoggerConfiguration()
    .Enrich.With(new IstTimestampEnricher())
    .WriteTo.Console(
        outputTemplate: "[{TimestampIst:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}",
        theme: Serilog.Sinks.SystemConsole.Themes.AnsiConsoleTheme.Code)
    .CreateBootstrapLogger();

try
{
    var builder = Host.CreateApplicationBuilder(args);

    // Build Serilog logger eagerly — the lazy (IServiceProvider, LoggerConfiguration) overload
    // caused an infinite-recursive hang on macOS. Pre-building avoids that.
    Log.Logger = new LoggerConfiguration()
        .ReadFrom.Configuration(builder.Configuration)
        .Enrich.FromLogContext()
        .Enrich.WithMachineName()
        .Enrich.With(new IstTimestampEnricher())
        .CreateLogger();
    builder.Services.AddSerilog(Log.Logger, dispose: true);

    builder.Services.AddUpstoxSdk(builder.Configuration);
    builder.Services.AddZerodhaSdk(builder.Configuration);
    builder.Services.AddDatabase(builder.Configuration);

    // MarketDataService: owns the upstream Upstox WebSocket, publishes ticks in-process
    // and to Redis (picked up by the Api via RedisLtpRelay). Must be registered BEFORE AddRiskEngine.
    builder.Services.AddMarketDataProducer();

    // Register HttpRiskEventNotifier before AddRiskEngine so TryAddSingleton doesn't override it
    builder.Services.AddHttpClient("RiskNotify", (sp, client) =>
    {
        var cfg = sp.GetRequiredService<IConfiguration>();
        var baseUrl = cfg["Api:BaseUrl"] ?? "https://localhost:5001";
        var internalKey = cfg["Api:InternalKey"] ?? "";
        client.BaseAddress = new Uri(baseUrl);
        client.DefaultRequestHeaders.Add("X-Internal-Key", internalKey);
    });
    builder.Services.AddSingleton<IRiskEventNotifier, HttpRiskEventNotifier>();

    // Register IBrokerClientFactory — OrderRoutingBrokerClientFactory wraps broker with
    // per-user OrderAgent when registered, falls back to direct broker otherwise.
    builder.Services.AddHttpClient("OrderAgent");
    builder.Services.AddSingleton<KAITerminal.OrderRouting.IOrderAgentRegistry,
                                   KAITerminal.OrderRouting.OrderAgentRegistry>();
    builder.Services.AddSingleton<KAITerminal.OrderRouting.IOrderAgentClient,
                                   KAITerminal.OrderRouting.HttpOrderAgentClient>();
    builder.Services.AddSingleton<KAITerminal.OrderRouting.IOrderRouter,
                                   KAITerminal.OrderRouting.OrderRouter>();
    builder.Services.AddSingleton<IBrokerClientFactory>(sp =>
    {
        var upstox  = sp.GetRequiredService<UpstoxClient>();
        var zerodha = sp.GetService<ZerodhaClient>();
        var registry = sp.GetRequiredService<KAITerminal.OrderRouting.IOrderAgentRegistry>();
        var router   = sp.GetRequiredService<KAITerminal.OrderRouting.IOrderRouter>();
        return new KAITerminal.Worker.OrderRouting.OrderRoutingBrokerClientFactory(
            upstox, zerodha, registry, router);
    });

    // Register cross-broker token mapper before AddRiskEngine so it overrides the default IdentityTokenMapper.
    // ITokenMappingProvider (ZerodhaTokenMappingProvider) is registered via AddMarketDataProducer() above.
    builder.Services.AddSingleton<ITokenMapper, CrossBrokerTokenMapper>();

    // Register OptionStrikeService and AutoShiftEvaluator before AddRiskEngine so TryAddSingleton
    // in AddRiskEngine does not override IAutoShiftEvaluator with the null implementation.
    // AutoShiftEvaluator takes Func<IPositionRefreshTrigger> (not IPositionRefreshTrigger directly)
    // to break the circular dependency:
    //   StreamingRiskWorker → AutoShiftEvaluator → IPositionRefreshTrigger → StreamingRiskWorker
    builder.Services.AddSingleton<OptionStrikeService>();
    builder.Services.AddSingleton<Func<IPositionRefreshTrigger>>(
        sp => () => sp.GetRequiredService<IPositionRefreshTrigger>());
    builder.Services.AddSingleton<AutoShiftOrderExecutor>();
    builder.Services.AddSingleton<IAutoShiftEvaluator, AutoShiftEvaluator>();

    builder.Services.AddRiskEngine<DbUserTokenSource>(builder.Configuration);

    builder.Services.AddHostedService<IvSnapshotJob>();

    builder.Services.AddSingleton<KAITerminal.Worker.Jobs.AutoEntry.IStrikeSelector,
                                  KAITerminal.Worker.Jobs.AutoEntry.AtmStrikeSelector>();
    builder.Services.AddSingleton<KAITerminal.Worker.Jobs.AutoEntry.IStrikeSelector,
                                  KAITerminal.Worker.Jobs.AutoEntry.OtmStrikeSelector>();
    builder.Services.AddSingleton<KAITerminal.Worker.Jobs.AutoEntry.IStrikeSelector,
                                  KAITerminal.Worker.Jobs.AutoEntry.DeltaStrikeSelector>();
    builder.Services.AddSingleton<KAITerminal.Worker.Jobs.AutoEntry.IStrikeSelector,
                                  KAITerminal.Worker.Jobs.AutoEntry.PremiumStrikeSelector>();
    builder.Services.AddSingleton<KAITerminal.Worker.Jobs.AutoEntry.StrikeSelectorRegistry>();
    builder.Services.AddSingleton<KAITerminal.Worker.Jobs.AutoEntry.AutoEntryOrderPlacer>();
    builder.Services.AddHostedService<KAITerminal.Worker.Jobs.AutoEntryJob>();

    var host = builder.Build();

    await host.Services
        .GetRequiredService<KAITerminal.OrderRouting.IOrderAgentRegistry>()
        .LoadAsync();

    // 60-second startup timeout — if any IHostedService.StartAsync hangs, fail fast and loud.
    using var startupCts = new CancellationTokenSource(TimeSpan.FromSeconds(60));
    try
    {
        await host.StartAsync(startupCts.Token);
    }
    catch (OperationCanceledException) when (startupCts.IsCancellationRequested)
    {
        Log.Fatal("Worker: host did not start within 60 seconds — check IHostedService.StartAsync for a blocking call");
        return 1;
    }

    await host.WaitForShutdownAsync();
    await host.StopAsync();
    return 0;
}
catch (Exception ex)
{
    Log.Fatal(ex, "Worker host terminated unexpectedly");
    return 1;
}
finally
{
    await Log.CloseAndFlushAsync();
}
