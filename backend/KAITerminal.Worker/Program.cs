using KAITerminal.Broker;
using KAITerminal.Broker.Adapters;
using KAITerminal.Infrastructure.Extensions;
using KAITerminal.RiskEngine.Extensions;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Worker;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Extensions;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddUpstoxSdk(builder.Configuration);
builder.Services.AddZerodhaSdk(builder.Configuration);
builder.Services.AddDatabase(builder.Configuration);

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

builder.Services.AddRiskEngine<DbUserTokenSource>(builder.Configuration);

if (!string.IsNullOrEmpty(builder.Configuration["ApplicationInsights:ConnectionString"]))
    builder.Services.AddApplicationInsightsTelemetryWorkerService(builder.Configuration);

var host = builder.Build();
host.Run();
