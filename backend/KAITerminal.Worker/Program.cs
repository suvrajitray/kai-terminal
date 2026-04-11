using KAITerminal.Broker;
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
    .WriteTo.Console()
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

    // Register IBrokerClientFactory — same pattern as KAITerminal.Api
    builder.Services.AddSingleton<IBrokerClientFactory>(sp =>
    {
        var creators = new Dictionary<string, Func<string, string?, IBrokerClient>>(
            StringComparer.OrdinalIgnoreCase);

        var upstox = sp.GetRequiredService<UpstoxClient>();
        creators[BrokerNames.Upstox] = (token, _) => new UpstoxBrokerClient(upstox, token);

        var zerodha = sp.GetService<ZerodhaClient>();
        if (zerodha is not null)
            creators[BrokerNames.Zerodha] = (token, apiKey) =>
                new ZerodhaBrokerClient(zerodha, apiKey!, token);

        return new BrokerClientFactory(creators);
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

    var host = builder.Build();

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
