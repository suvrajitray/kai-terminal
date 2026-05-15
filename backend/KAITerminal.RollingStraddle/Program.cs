using KAITerminal.Infrastructure.Data;
using KAITerminal.MarketData.Extensions;
using KAITerminal.Util;
using KAITerminal.RollingStraddle.Configuration;
using KAITerminal.RollingStraddle.Services;
using KAITerminal.Upstox.Extensions;
using Microsoft.EntityFrameworkCore;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .Enrich.With(new IstTimestampEnricher())
    .WriteTo.Console(
        outputTemplate: "[{TimestampIst:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}",
        theme: Serilog.Sinks.SystemConsole.Themes.AnsiConsoleTheme.Code)
    .CreateBootstrapLogger();

try
{
    // Builder created first so we can read connection string and strategy config from appsettings.
    var builder = Host.CreateApplicationBuilder(args);
    var overrides = new List<KeyValuePair<string, string?>>();

    var inst = PickInstrument(builder.Configuration);
    overrides.Add(new("Strategy:Underlying", inst.Underlying));
    overrides.Add(new("Strategy:LotSize",    inst.LotSize.ToString()));

    string? promptedUsername = null;
    Prompt("Username (Enter to use appsettings value): ",
        v => { promptedUsername = v; overrides.Add(new("Strategy:Username", v)); });

    Prompt("Expiry yyyy-MM-dd (Enter to auto-resolve nearest expiry): ",
        v => overrides.Add(new("Strategy:Expiry", v)));

    Prompt("Lots (Enter to use appsettings value): ",
        v => overrides.Add(new("Strategy:Lots", v)));

    Prompt("Daily MTM target per lot ₹ (Enter to use appsettings value): ",
        v => overrides.Add(new("Strategy:DailyMtmTargetPerLot", v)));

    Prompt("Daily MTM stop-loss per lot ₹ (Enter to use appsettings value): ",
        v => overrides.Add(new("Strategy:DailyMtmStopLossPerLot", v)));

    Prompt("Strike offset — 0 straddle, N strangle (Enter to use appsettings value): ",
        v => overrides.Add(new("Strategy:StrikeOffset", v)));

    // Resolve Upstox access token — manual paste overrides DB fetch.
    string accessToken;
    Console.Write("Upstox access token (Enter to fetch from DB): ");
    var manualToken = Console.ReadLine()?.Trim() ?? string.Empty;

    if (!string.IsNullOrEmpty(manualToken))
    {
        accessToken = manualToken;
        Log.Information("[CONFIG] Using manually entered access token.");
    }
    else
    {
        var username   = promptedUsername ?? builder.Configuration["Strategy:Username"] ?? "";
        var brokerName = builder.Configuration["Strategy:BrokerName"] ?? "";
        var connStr    = builder.Configuration.GetConnectionString("DefaultConnection") ?? "";

        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(brokerName))
        {
            Log.Fatal("[CONFIG] Strategy:Username and Strategy:BrokerName must be set in appsettings.json.");
            return 1;
        }

        if (string.IsNullOrEmpty(connStr))
        {
            Log.Fatal("[CONFIG] ConnectionStrings:DefaultConnection is not set — add via rs.env and restart.");
            return 1;
        }

        var dbOptions = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connStr).Options;
        await using var db = new AppDbContext(dbOptions);

        var cred = await db.BrokerCredentials
            .FirstOrDefaultAsync(c => c.Username == username && c.BrokerName == brokerName);

        if (cred is null)
        {
            Log.Fatal("[CONFIG] No {Broker} credentials found for {User} — authenticate via the web app first.",
                brokerName, username);
            return 1;
        }

        var tokenStatus = BrokerTokenHelper.Validate(cred.AccessToken, cred.UpdatedAt, cred.BrokerName);
        if (tokenStatus != TokenValidationResult.Valid)
        {
            Log.Fatal("[CONFIG] {Broker} token for {User} is {Status} — re-authenticate via the web app and retry.",
                brokerName, username, tokenStatus);
            return 1;
        }

        Log.Information("[CONFIG] Loaded {Broker} token for {User} (updated {At:HH:mm:ss})",
            brokerName, username, cred.UpdatedAt.ToLocalTime());

        accessToken = cred.AccessToken;
    }

    overrides.Add(new("Upstox:AccessToken", accessToken));

    if (overrides.Count > 0)
        builder.Configuration.AddInMemoryCollection(overrides);

    Log.Logger = new LoggerConfiguration()
        .ReadFrom.Configuration(builder.Configuration)
        .Enrich.FromLogContext()
        .Enrich.With(new IstTimestampEnricher())
        .CreateLogger();

    builder.Services.AddSerilog(Log.Logger, dispose: true);
    builder.Services.AddUpstoxSdk(builder.Configuration);
    builder.Services.AddMarketDataCore(builder.Configuration);

    builder.Services.Configure<StrategyConfig>(
        builder.Configuration.GetSection(StrategyConfig.SectionName));

    builder.Services.AddSingleton<MarketDataFeed>();
    builder.Services.AddSingleton<OrderExecutor>();
    builder.Services.AddSingleton<PositionLedger>();
    builder.Services.AddHostedService<StrategyRunner>();

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

static (string Name, string Underlying, int LotSize) PickInstrument(IConfiguration config)
{
    Console.Write("Instrument — 1. NIFTY  2. SENSEX (Enter for NIFTY): ");
    var input = Console.ReadLine()?.Trim() ?? string.Empty;

    var key        = input == "2" ? "Sensex" : "Nifty";
    var name       = input == "2" ? "SENSEX" : "NIFTY";
    var underlying = config[$"Instruments:{key}:Underlying"] ?? "";
    var lotSize    = int.TryParse(config[$"Instruments:{key}:LotSize"], out var ls) ? ls : 65;

    return (name, underlying, lotSize);
}
