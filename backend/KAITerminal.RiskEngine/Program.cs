using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Upstox;
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

var riskConfig = builder.Configuration.GetSection("RiskEngine").Get<RiskConfig>() ?? new RiskConfig();
builder.Services.AddSingleton(riskConfig);

// ================= CORE =================

builder.Services.AddSingleton<PriceCache>();
builder.Services.AddSingleton<IRiskRepository, InMemoryRiskRepository>();
builder.Services.AddSingleton<IStrategyProvider, InMemoryStrategyProvider>();

// ================= RISK =================

builder.Services.AddSingleton<StrikeMonitor>();
builder.Services.AddSingleton<RiskEvaluator>();

// ================= UPSTOX =================

builder.Services.AddSingleton<IPositionProvider, UpstoxPositionProvider>();
builder.Services.AddSingleton<IOrderExecutor, UpstoxOrderExecutor>();

// ================= WORKERS =================

builder.Services.AddHostedService<RiskBackgroundWorker>();
builder.Services.AddHostedService<StrikeRiskWorker>();
builder.Services.AddHostedService<StartupSeeder>();

var host = builder.Build();
host.Run();
