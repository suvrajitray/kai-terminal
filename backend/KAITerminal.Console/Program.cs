using KAITerminal.Console;
using KAITerminal.RiskEngine.Extensions;
using KAITerminal.Upstox.Extensions;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddUpstoxSdk(builder.Configuration);
builder.Services.AddRiskEngine<SingleUserTokenSource>(builder.Configuration);

var host = builder.Build();
host.Run();
