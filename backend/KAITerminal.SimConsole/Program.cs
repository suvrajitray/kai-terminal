using KAITerminal.RiskEngine.Extensions;
using KAITerminal.SimConsole;
using KAITerminal.SimConsole.Simulation;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Upstox.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

// Register the Upstox SDK (wires UpstoxClient + HTTP clients + streaming factories).
// No real token needed — the sim services below never make HTTP calls.
builder.Services.AddUpstoxSdk(cfg => cfg.AccessToken = "sim-token");

// Override the three services that make real broker API calls with no-op simulators.
// Microsoft DI uses the last registration, so these shadow the ones added by AddUpstoxSdk.
builder.Services.AddSingleton<IPositionService, SimPositionService>();
builder.Services.AddSingleton<IOrderService, SimOrderService>();
builder.Services.AddSingleton<IOptionService, SimOptionService>();

// Risk engine with simulated single user.
builder.Services.AddRiskEngine<SimTokenSource>(builder.Configuration);

var host = builder.Build();
host.Run();
