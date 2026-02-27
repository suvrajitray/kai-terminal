using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Zerodha;
using KAITerminal.RiskEngine.Brokers.Zerodha;
using KAITerminal.RiskEngine.Infrastructure;
using KAITerminal.RiskEngine.Interfaces;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Risk;
using KAITerminal.RiskEngine.Workers;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<ZerodhaSettings>(
    builder.Configuration.GetSection("Zerodha"));

builder.Services.AddHttpClient<KiteConnectHttpClient>();

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
builder.Services.AddHostedService<DummyTickGenerator>();
builder.Services.AddHostedService<StartupSeeder>();

// ================= ZERODHA (STUB) =================

// builder.Services.AddHttpClient();
// builder.Services.AddSingleton<IPositionProvider, ZerodhaPositionProvider>();
builder.Services.AddSingleton<IPositionProvider, DummyPositionProvider>();
builder.Services.AddSingleton<IOrderExecutor, ZerodhaOrderExecutor>();

var host = builder.Build();
host.Run();
