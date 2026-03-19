# KAITerminal.RiskEngine

A self-contained .NET library that implements autonomous portfolio risk management for options trading. Drop it into any host (Worker Service or Console) via a single `AddRiskEngine<T>()` call.

---

## What It Does

`StreamingRiskWorker` runs continuously and takes autonomous action:

- Connects a Portfolio WebSocket stream and a Market Data WebSocket stream per user
- Portfolio events (order fills, position changes) trigger an immediate REST position re-fetch + risk evaluation
- LTP ticks update the in-memory position cache; risk is evaluated from cache on a rate-limited interval (no extra REST calls)
- All risk checks run via `RiskEvaluator` which reads per-user thresholds from `UserConfig`

State is held in memory and resets when the host restarts.

---

## Portfolio Risk Rules

Evaluated against total MTM P&L. Checks run in this order:

| # | Rule | Config key | Action |
|---|---|---|---|
| 1 | Hard stop loss | `MtmSl` | Square off all positions |
| 2 | Profit target | `MtmTarget` | Square off all positions |
| 3 | Trailing SL — activation | `TrailingActivateAt` | Arm trailing; floor locked at `LockProfitAt` |
| 3 | Trailing SL — step up | `WhenProfitIncreasesBy` | Raise floor by `IncreaseTrailingBy` |
| 3 | Trailing SL — fire | — | MTM ≤ trailing floor → square off |

**Trailing SL example:**

```
MTM crosses TrailingActivateAt (+15,000)
  → floor locked at LockProfitAt (+3,025) — guaranteed regardless of entry MTM

MTM reaches +16,000 → gain=1,000 ≥ WhenProfitIncreasesBy
  → floor raised by IncreaseTrailingBy → floor=+3,525

MTM reaches +17,000 → gain=1,000
  → floor raised → floor=+4,025

MTM falls to +3,900 → 3,900 ≤ floor=+4,025 → TSL fires → exit all
```

The floor is always set to `LockProfitAt` at activation, **not** relative to MTM at that moment. This gives a predictable guaranteed minimum profit.

**Log output during a portfolio check:**

```
# Trailing not yet active
suvrajit.ray@gmail.com (upstox)  PnL ₹+2,100  |  SL ₹-25,000  |  Target ₹+25,000  |  TSL off — activates at ₹+15,000

# Trailing activates
TSL ACTIVATED — suvrajit.ray@gmail.com (upstox)  floor locked at ₹+3,025

# Heartbeat with TSL active
suvrajit.ray@gmail.com (upstox)  PnL ₹+16,800  |  Target ₹+25,000  |  TSL ₹+3,025

# Floor steps up
TSL RAISED — suvrajit.ray@gmail.com (upstox)  floor → ₹+3,525

# TSL fires
TSL HIT — suvrajit.ray@gmail.com (upstox)  PnL ₹+3,400  ≤  floor ₹+3,525 — exiting all
Square-off complete — suvrajit.ray@gmail.com (upstox) — all positions exited
```

---

## Project Structure

```
KAITerminal.RiskEngine/
├── Configuration/
│   └── RiskEngineConfig.cs          Trading window, LTP eval interval, exchange filter
├── Models/
│   ├── UserConfig.cs                UserId + AccessToken + BrokerType + thresholds
│   └── UserRiskState.cs             Per-user mutable state (trailing, squared-off)
├── Abstractions/
│   ├── IRiskRepository.cs           GetOrCreate / Update / Reset per userId
│   ├── IPositionCache.cs            UpdatePositions / UpdateLtp / GetMtm / GetOpenTokens
│   └── IUserTokenSource.cs          GetUsersAsync() → IEnumerable<UserConfig>
├── State/
│   ├── InMemoryRiskRepository.cs    ConcurrentDictionary-backed, thread-safe
│   └── InMemoryPositionCache.cs     Per-user position + LTP cache for MTM computation
├── Services/
│   └── RiskEvaluator.cs             Portfolio-level checks (SL, target, trailing SL)
├── Workers/
│   └── StreamingRiskWorker.cs       BackgroundService — WebSocket-driven, multi-user
└── Extensions/
    └── RiskEngineExtensions.cs      AddRiskEngine<TTokenSource>() DI helper
```

---

## Integration

### 1. Implement `IUserTokenSource`

The library needs to know which users to monitor and what credentials to use. Two built-in implementations:

**`DbUserTokenSource`** (Worker) — queries `UserRiskConfigs WHERE Enabled=true` joined with `BrokerCredentials` on every tick. Auto-picks up DB changes without restart.

**`SingleUserTokenSource`** (Console) — reads `Upstox:AccessToken` from config for a single hardcoded user.

For a custom source implement `IUserTokenSource`:

```csharp
public sealed class MyTokenSource : IUserTokenSource
{
    public Task<IEnumerable<UserConfig>> GetUsersAsync(CancellationToken ct)
        => Task.FromResult<IEnumerable<UserConfig>>([
            new UserConfig { UserId = "user@example.com", AccessToken = "...", BrokerType = "upstox" }
        ]);
}
```

### 2. Register in `Program.cs`

```csharp
builder.Services.AddBrokerServices(builder.Configuration);   // registers IBrokerClientFactory
builder.Services.AddRiskEngine<DbUserTokenSource>(builder.Configuration);
```

`AddRiskEngine<T>` registers:
- `IRiskRepository` → `InMemoryRiskRepository` (singleton)
- `IPositionCache` → `InMemoryPositionCache` (singleton)
- `IUserTokenSource` → `T` (singleton)
- `RiskEvaluator` (singleton)
- `StreamingRiskWorker` as a hosted service

### 3. Token scoping

`StreamingRiskWorker` calls `broker.UseToken()` to scope credentials per user via the broker's ambient token context (`UpstoxTokenContext` / `ZerodhaTokenContext`). Concurrent users never share tokens.

---

## Configuration

Thresholds are stored per-user in the `UserRiskConfigs` DB table (loaded by `DbUserTokenSource`). The `RiskEngine` config section in `appsettings.json` only controls worker behaviour:

```json
{
  "RiskEngine": {
    "TradingWindowStart": "09:15:00",
    "TradingWindowEnd":   "15:30:00",
    "TradingTimeZone":    "India Standard Time",
    "LtpEvalMinIntervalMs": 15000,
    "Exchanges": ["NFO", "BFO"]
  }
}
```

| Key | Meaning |
|---|---|
| `TradingWindowStart` / `TradingWindowEnd` | Risk evaluation only runs within this window |
| `TradingTimeZone` | IANA or Windows timezone ID used for the trading window |
| `LtpEvalMinIntervalMs` | Minimum ms between LTP-tick-triggered evaluations (default 15,000) |
| `Exchanges` | Only positions from these exchanges are included in MTM |

Per-user thresholds (`MtmSl`, `MtmTarget`, `TrailingEnabled`, `TrailingActivateAt`, `LockProfitAt`, `WhenProfitIncreasesBy`, `IncreaseTrailingBy`) live in `UserRiskConfigs` and are managed via `GET /PUT /api/risk-config` from the frontend.

---

## State Lifecycle

| Event | State change |
|---|---|
| Host starts | `UserRiskState` created fresh for each user on first check |
| TSL activates | `TrailingActive = true`, `TrailingStop = LockProfitAt`, `TrailingLastTrigger = mtm` |
| TSL raises | `TrailingStop` and `TrailingLastTrigger` incremented by the step |
| Square-off | `IsSquaredOff = true`; all further evaluation is skipped |
| Host restarts | All state lost; engine starts fresh |

State is intentionally in-memory only — the engine is designed to be set up fresh each trading day.
