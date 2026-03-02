using KAITerminal.RiskEngine.Extensions;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Worker;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddUpstoxSdk(builder.Configuration);
builder.Services.AddRiskEngine<ConfigTokenSource>(builder.Configuration);

var host = builder.Build();
host.Run();
