using KAITerminal.RiskEngine;
using RiskEngine.Models;
using RiskEngine.Services;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddSingleton<RiskState>();
builder.Services.AddSingleton<RiskConfig>();
builder.Services.AddSingleton<IRiskEngine, TerminalRiskEngine>();

builder.Services.AddHostedService<Worker>();

builder.Services.AddSingleton<IPositionProvider, PositionProvider>();
builder.Services.AddSingleton<IOrderExecutor, OrderExecutor>();

var host = builder.Build();
host.Run();
