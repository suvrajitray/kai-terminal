using KAITerminal.Console;
using KAITerminal.RiskEngine.Extensions;
using KAITerminal.Upstox.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

Console.WriteLine();
Console.WriteLine($"Environment: {builder.Environment.EnvironmentName}");
Console.WriteLine();

builder.Services.AddUpstoxSdk(builder.Configuration);
builder.Services.AddRiskEngine<SingleUserTokenSource>(builder.Configuration);
builder.Services.AddApplicationInsightsTelemetryWorkerService(builder.Configuration);

var host = builder.Build();
host.Run();
