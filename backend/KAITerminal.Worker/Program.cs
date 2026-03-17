using KAITerminal.Infrastructure.Extensions;
using KAITerminal.RiskEngine.Extensions;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Worker;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddUpstoxSdk(builder.Configuration);
builder.Services.AddDatabase(builder.Configuration);
builder.Services.AddRiskEngine<DbUserTokenSource>(builder.Configuration);
builder.Services.AddApplicationInsightsTelemetryWorkerService(builder.Configuration);

var host = builder.Build();
host.Run();
