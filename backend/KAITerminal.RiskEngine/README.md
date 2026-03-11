# KAITerminal.RiskEngine

A self-contained .NET library that implements autonomous risk management for options trading on Upstox. Drop it into any host (Worker Service or Console) via a single `AddRiskEngine<T>()` call.

---

## What It Does

Two background workers run continuously and take autonomous action:

| Worker | Interval | Checks |
|---|---|---|
| `PortfolioRiskWorker` | 60 s (configurable) | Overall stop loss, profit target, trailing stop loss |
| `StrikeRiskWorker` | 5 s (configurable) | Per-strike CE/PE loss %; exits + OTM1 re-entry |

All logic fires without any manual intervention. State is held in memory and resets when the host restarts.

---

## Portfolio Risk Rules

Evaluated every `PortfolioCheckIntervalSeconds` seconds against total MTM P&L.

| Rule | Config key | Default | Action |
|---|---|---|---|
| Overall Stop Loss | `OverallStopLoss` | MTM ≤ −₹25,000 | Square off all positions |
| Profit Target | `ProfitTarget` | MTM ≥ +₹25,000 | Square off all positions |
| Trailing SL — activation | `TrailingActivateAt` | MTM ≥ +₹5,000 | Arm trailing; stop locked at `LockProfitAt` |
| Trailing SL — step up | `WhenProfitIncreasesBy` | Every +₹1,000 gain | Raise stop by `IncreaseTrailingBy` (₹500) |
| Trailing SL — fire | — | MTM ≤ trailing stop | Square off all positions |

**Trailing SL example** (defaults):

```
MTM crosses +5,000 (TrailingActivateAt)
  → trailing stop locked at +2,000 (LockProfitAt) — guaranteed floor regardless of entry MTM

MTM reaches +6,000 → gain=1,000 ≥ WhenProfitIncreasesBy
  → stop raised by IncreaseTrailingBy=500 → stop=+2,500

MTM reaches +7,000 → gain=1,000 ≥ WhenProfitIncreasesBy
  → stop raised → stop=+3,000

MTM falls to +2,800 → 2,800 ≤ stop=3,000 → trailing SL fires → exit all
```

The stop is always set to `LockProfitAt` at activation, **not** relative to the MTM at the moment of activation. This gives a predictable guaranteed minimum profit whenever the trailing stop fires.

Log output during a portfolio check:

```
# Trailing not yet active — overall SL shown as the relevant floor
[user@example.com]  PnL=+2100  SL=-25000  Target=+25000  TSL=inactive (activates at +5000)

# After trailing activates — overall SL hidden (trailing stop is always higher)
Trailing SL activated  stop locked at=+2000
[user@example.com]  PnL=+6800  Target=+25000  TSL=+2000

# Stop raised as profit grows
Trailing SL raised  stop=+2500
[user@example.com]  PnL=+7300  Target=+25000  TSL=+2500
```

---

## Strike Risk Rules

Evaluated every `StrikeCheckIntervalSeconds` seconds against each open NFO position.

| Option | Loss threshold | Formula |
|---|---|---|
| CE | > 20% | `(LTP − AvgPrice) / AvgPrice > 0.20` |
| PE | > 30% | `(LTP − AvgPrice) / AvgPrice > 0.30` |

On trigger:
1. Exit the position via `ExitPositionAsync`.
2. If `reentryCount < MaxReentries` (default 2): place a new SELL order at OTM1 of the same underlying/expiry via `PlaceOrderByStrikeV3Async`.

Re-entry count is tracked per trading symbol and resets when the host restarts.

---

## Project Structure

```
KAITerminal.RiskEngine/
├── Configuration/
│   └── RiskEngineConfig.cs          All thresholds + intervals + Users[] list
├── Models/
│   ├── UserConfig.cs                UserId + AccessToken (used by Worker)
│   └── UserRiskState.cs             Per-user mutable state (trailing, squared-off, re-entries)
├── Abstractions/
│   ├── IRiskRepository.cs           GetOrCreate / Update / Reset per userId
│   └── IUserTokenSource.cs          GetUsers() → IReadOnlyList<UserConfig>
├── State/
│   └── InMemoryRiskRepository.cs    ConcurrentDictionary-backed, thread-safe
├── Services/
│   ├── RiskEvaluator.cs             Portfolio-level checks (overall SL, target, trailing SL)
│   └── StrikeMonitor.cs             Per-strike CE/PE checks + OTM re-entry
├── Workers/
│   ├── PortfolioRiskWorker.cs       BackgroundService — 60 s loop
│   └── StrikeRiskWorker.cs          BackgroundService — 5 s loop
└── Extensions/
    └── RiskEngineExtensions.cs      AddRiskEngine<TTokenSource>() DI helper
```

---

## Integration

### 1. Implement `IUserTokenSource`

The library needs to know which users to monitor and what token to use for each. Implement one of these patterns depending on your host:

**Multi-user (Worker Service)** — reads `RiskEngine:Users[]` from config:

```csharp
public sealed class ConfigTokenSource : IUserTokenSource
{
    private readonly RiskEngineConfig _cfg;
    public ConfigTokenSource(IOptions<RiskEngineConfig> cfg) => _cfg = cfg.Value;
    public IReadOnlyList<UserConfig> GetUsers() => _cfg.Users;
}
```

**Single-user (Console)** — reads `Upstox:AccessToken` from config:

```csharp
public sealed class SingleUserTokenSource : IUserTokenSource
{
    private readonly IReadOnlyList<UserConfig> _users;
    public SingleUserTokenSource(IOptions<UpstoxConfig> cfg)
        => _users = [new UserConfig { UserId = "console", AccessToken = cfg.Value.AccessToken ?? "" }];
    public IReadOnlyList<UserConfig> GetUsers() => _users;
}
```

### 2. Register in `Program.cs`

```csharp
builder.Services.AddUpstoxSdk(builder.Configuration);
builder.Services.AddRiskEngine<ConfigTokenSource>(builder.Configuration);
```

`AddRiskEngine<T>` registers:
- `IRiskRepository` → `InMemoryRiskRepository` (singleton)
- `IUserTokenSource` → `T` (singleton)
- `RiskEvaluator` and `StrikeMonitor` (singletons)
- `PortfolioRiskWorker` and `StrikeRiskWorker` as hosted services

### 3. Token scoping

Each worker iteration wraps broker calls in `UpstoxTokenContext.Use(token)` so concurrent users never share tokens:

```csharp
foreach (var user in tokenSource.GetUsers())
{
    using (UpstoxTokenContext.Use(user.AccessToken))
    {
        await riskEvaluator.EvaluateAsync(user.UserId, ct);
    }
}
```

---

## Configuration

All settings live under the `RiskEngine` key in `appsettings.json`. No code changes needed to tune thresholds.

```json
{
  "RiskEngine": {
    "OverallStopLoss": -25000,
    "ProfitTarget": 25000,
    "EnableTrailingStopLoss": true,
    "TrailingActivateAt": 5000,
    "LockProfitAt": 2000,
    "WhenProfitIncreasesBy": 1000,
    "IncreaseTrailingBy": 500,
    "EnableStrikeWorker": true,
    "CeStopLossPercent": 0.20,
    "PeStopLossPercent": 0.30,
    "MaxReentries": 2,
    "PortfolioCheckIntervalSeconds": 60,
    "StrikeCheckIntervalSeconds": 5,
    "Users": [
      { "UserId": "user@example.com", "AccessToken": "" }
    ]
  }
}
```

| Key | Default | Meaning |
|---|---|---|
| `OverallStopLoss` | −25,000 | Square off immediately if MTM hits this |
| `ProfitTarget` | +25,000 | Square off immediately if MTM hits this |
| `EnableTrailingStopLoss` | `true` | Set to `false` to disable trailing SL entirely; only overall SL and profit target apply |
| `TrailingActivateAt` | +5,000 | MTM level that arms the trailing SL |
| `LockProfitAt` | +2,000 | Trailing stop value the moment TSL arms — your guaranteed floor |
| `WhenProfitIncreasesBy` | +1,000 | MTM must gain this much from last step to raise the stop |
| `IncreaseTrailingBy` | +500 | How much the stop rises each time the profit step is crossed |
| `EnableStrikeWorker` | `true` | Set to `false` to disable per-strike CE/PE checks entirely |
| `CeStopLossPercent` | 0.20 (20%) | CE loss threshold relative to entry price |
| `PeStopLossPercent` | 0.30 (30%) | PE loss threshold relative to entry price |
| `MaxReentries` | 2 | Max OTM re-entries after a strike SL |
| `PortfolioCheckIntervalSeconds` | 60 | How often portfolio risk is evaluated |
| `StrikeCheckIntervalSeconds` | 5 | How often per-strike risk is evaluated |

`Users[]` is only needed when using `ConfigTokenSource` (Worker). For Console, omit it.

Store real access tokens in `dotnet user-secrets`, not in `appsettings.json`:

```bash
dotnet user-secrets set "RiskEngine:Users:0:AccessToken" "<daily_upstox_token>"
```

---

## State Lifecycle

| Event | State change |
|---|---|
| Host starts | `UserRiskState` created fresh for each user on first check |
| Trailing SL activates | `TrailingActive = true`, `TrailingStop = LockProfitAt`, `TrailingLastTrigger = mtm` |
| Square-off | `IsSquaredOff = true`; both workers skip further evaluation |
| Host restarts | All state lost; engine starts fresh |

State is intentionally in-memory only. Persistence across restarts is not implemented — the intent is that the engine is set up fresh each trading day.

---

## Custom Risk Worker Pattern

If you need a lightweight risk monitor without the full `KAITerminal.RiskEngine` library — for example a single-purpose worker that combines live market ticks with periodic P&L checks — you can build directly on the Upstox SDK:

```csharp
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.WebSocket;

/// <summary>
/// Streams live market ticks and polls MTM on a timer.
/// Exits all positions if MTM falls below a configurable overall stop.
/// </summary>
public sealed class RiskMonitorWorker : BackgroundService
{
    private readonly UpstoxClient _client;
    private readonly ILogger<RiskMonitorWorker> _logger;
    private readonly decimal _overallStopLoss;

    public RiskMonitorWorker(
        UpstoxClient client,
        ILogger<RiskMonitorWorker> logger,
        IConfiguration config)
    {
        _client          = client;
        _logger          = logger;
        _overallStopLoss = config.GetValue<decimal>("RiskMonitor:OverallStopLoss", -25_000);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await using var streamer = _client.CreateMarketDataStreamer();

        streamer.FeedReceived += (_, msg) =>
        {
            // Real-time tick handler — keep fast, no blocking I/O
            foreach (var (key, feed) in msg.Instruments)
                if (feed.Ltpc is { } ltpc)
                    _logger.LogDebug("{Key}  LTP={Ltp}", key, ltpc.Ltp);
        };

        await streamer.ConnectAsync(stoppingToken);
        await streamer.SubscribeAsync(["NSE_INDEX|Nifty 50"], FeedMode.Ltpc, stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(60));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                var mtm = await _client.GetTotalMtmAsync(stoppingToken);
                _logger.LogInformation("MTM: ₹{Mtm:F2}  OverallSL: ₹{Sl}", mtm, _overallStopLoss);

                if (mtm <= _overallStopLoss)
                {
                    _logger.LogCritical("Overall SL breached — exiting all positions");
                    await _client.ExitAllPositionsAsync(cancellationToken: stoppingToken);
                    break;
                }
            }
        }
        catch (OperationCanceledException) { }
        finally { await streamer.DisconnectAsync(); }
    }
}
```

**When to use this vs `AddRiskEngine<T>()`:**

| | `AddRiskEngine<T>()` | Custom worker |
|---|---|---|
| Trailing SL | Yes | Implement yourself |
| Per-strike CE/PE checks | Yes | Implement yourself |
| Multi-user support | Yes (`IUserTokenSource`) | Manual token scoping |
| Re-entry logic | Yes | Implement yourself |
| Complexity | Managed by the library | Full control |

Use `AddRiskEngine<T>()` for production trading. Use a custom worker when you need a minimal, self-contained monitor (e.g. a quick stop-loss guard for a single account).
