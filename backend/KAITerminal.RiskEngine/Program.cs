using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Upstox;
using KAITerminal.RiskEngine.Brokers.Upstox;
using KAITerminal.RiskEngine.Infrastructure;
using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Risk;
using KAITerminal.RiskEngine.Workers;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<UpstoxSettings>(
    builder.Configuration.GetSection("Upstox"));

builder.Services.AddHttpClient<UpstoxHttpClient>();

// ================= CONFIG =================

builder.Services.AddSingleton(new RiskConfig
{
  OverallStopLoss = -25000,
  OverallTarget = 25000,
});

// ================= CORE =================

builder.Services.AddSingleton<PriceCache>();
builder.Services.AddSingleton<IRiskRepository, InMemoryRiskRepository>();
builder.Services.AddSingleton<IStrategyProvider, InMemoryStrategyProvider>();

// ================= RISK =================

builder.Services.AddSingleton<StrikeMonitor>();
builder.Services.AddSingleton<RiskEvaluator>();

// ================= WORKERS =================

builder.Services.AddSingleton<TickRiskWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<TickRiskWorker>());
builder.Services.AddHostedService<RiskBackgroundWorker>();

// 🔥 TODO: Following two services are for testing simulation.
builder.Services.AddSingleton<UpstoxTickWebSocket>();
builder.Services.AddHostedService<DummyTickGenerator>();
builder.Services.AddHostedService<StartupSeeder>();

// ================= UPSTOX (STUB) =================

builder.Services.AddSingleton<IPositionProvider, DummyPositionProvider>();
builder.Services.AddSingleton<IOrderExecutor, UpstoxOrderExecutor>();

var host = builder.Build();
host.Run();
