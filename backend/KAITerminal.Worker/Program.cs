using KAITerminal.Broker;
using KAITerminal.Broker.Adapters;
using KAITerminal.Contracts.Notifications;
using KAITerminal.Contracts.Broker;
using KAITerminal.Contracts.Streaming;
using KAITerminal.Infrastructure.Extensions;
using KAITerminal.MarketData.Extensions;
using KAITerminal.RiskEngine.Extensions;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Worker;
using KAITerminal.Worker.Mapping;
using KAITerminal.Worker.Notifications;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Extensions;
using KAITerminal.Zerodha.Options;

var builder = Host.CreateApplicationBuilder(args);

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
    creators["upstox"] = (token, _) => new UpstoxBrokerClient(upstox, token);

    var zerodha = sp.GetService<ZerodhaClient>();
    if (zerodha is not null)
        creators["zerodha"] = (token, apiKey) =>
            new ZerodhaBrokerClient(zerodha, apiKey!, token);

    return new BrokerClientFactory(creators);
});

// Register one ITokenMappingProvider per non-Upstox broker.
// CrossBrokerTokenMapper injects IEnumerable<ITokenMappingProvider> — adding Dhan etc.
// means registering its provider here; CrossBrokerTokenMapper needs no changes.
builder.Services.AddSingleton<ITokenMappingProvider, ZerodhaTokenMappingProvider>();

// Register cross-broker token mapper before AddRiskEngine so it overrides the default IdentityTokenMapper.
builder.Services.AddSingleton<ITokenMapper, CrossBrokerTokenMapper>();

builder.Services.AddRiskEngine<DbUserTokenSource>(builder.Configuration);

if (!string.IsNullOrEmpty(builder.Configuration["ApplicationInsights:ConnectionString"]))
    builder.Services.AddApplicationInsightsTelemetryWorkerService(builder.Configuration);

var host = builder.Build();
host.Run();
