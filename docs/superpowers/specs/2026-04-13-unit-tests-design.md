# Unit Tests Design

**Date:** 2026-04-13
**Scope:** Backend — pure logic classes with real financial consequences

---

## Goals

Add a focused unit test suite covering the four backend classes where a bug has direct financial impact or correctness guarantees matter most. No integration tests, no mocking of external services — only pure, side-effect-free logic.

---

## Project Structure

```
backend/
  KAITerminal.Tests/
    KAITerminal.Tests.csproj
    RiskEngine/
      RiskDecisionCalculatorTests.cs
      TrailingStopCalculatorTests.cs
      UserRiskStateTests.cs
    Contracts/
      ProductTypeFilterTests.cs
    Api/
      PositionMapperTests.cs
```

### `.csproj` dependencies

**NuGet:**
- `xunit`
- `xunit.runner.visualstudio`
- `FluentAssertions`
- `Microsoft.NET.Test.Sdk`

**ProjectReferences:**
- `KAITerminal.RiskEngine`
- `KAITerminal.Contracts`
- `KAITerminal.Api`

### `InternalsVisibleTo`

`KAITerminal.Api.csproj` requires one addition to expose `PositionMapper` (which is `internal`):

```xml
<InternalsVisibleTo Include="KAITerminal.Tests" />
```

### Running tests

```bash
dotnet test backend/KAITerminal.Tests
```

---

## Test Cases

### `RiskDecisionCalculator`

The evaluation order is critical: MTM SL → Target → Auto square-off → Trailing SL. Tests must assert this ordering explicitly.

| Scenario | Input | Expected `Kind` |
|---|---|---|
| MTM at SL boundary | `mtm == config.MtmSl` | `ExitMtmSl` |
| MTM below SL | `mtm < config.MtmSl` | `ExitMtmSl` |
| MTM at target boundary | `mtm == config.MtmTarget` | `ExitTarget` |
| MTM above target | `mtm > config.MtmTarget` | `ExitTarget` |
| Auto square-off enabled, time met | `AutoSquareOffEnabled=true`, `nowIst >= AutoSquareOffTime` | `ExitAutoSquareOff` |
| Auto square-off disabled | `AutoSquareOffEnabled=false` | `None` |
| Trailing inactive, below threshold | `mtm < TrailingActivateAt` | `None` |
| Trailing activation tick | `mtm >= TrailingActivateAt`, `TrailingActive=false` | `None` + `TrailingUpdate.IsActivation=true` |
| Trailing active, floor hit | `mtm <= state.TrailingStop` | `ExitTrailingSl` |
| Floor raised this tick, new floor immediately hit | raised floor > mtm | `ExitTrailingSl` |
| SL priority over target | mtm satisfies both SL and target | `ExitMtmSl` (SL wins) |

### `TrailingStopCalculator`

| Scenario | Expected |
|---|---|
| Trailing disabled | `null` |
| Not active, below threshold | `null` |
| Exactly at activation threshold | `IsActivation=true`, `NewStop=LockProfitAt` |
| Active, gain < one step | `null` |
| Active, gain = exactly 1 step | `NewStop = TrailingStop + IncreaseTrailingBy` |
| Active, gain = 2.5 steps | `NewStop = TrailingStop + 2 × IncreaseTrailingBy` (integer steps) |

### `ProductTypeFilter`

| Filter | Passes | Blocked |
|---|---|---|
| `"All"` | `"I"`, `"D"`, `"MIS"`, `"NRML"`, `"CO"`, `"CNC"` | nothing |
| `"Intraday"` | `"I"`, `"MIS"` | `"D"`, `"NRML"`, `"CO"`, `"CNC"` |
| `"Delivery"` | `"D"`, `"NRML"` | `"I"`, `"MIS"`, `"CO"`, `"CNC"` |
| Case-insensitive | `"mis"` passes `"Intraday"` | — |

### `PositionMapper` (internal — requires `InternalsVisibleTo`)

**Product parsing:**

| Raw | Expected `ProductType` |
|---|---|
| `"D"`, `"CNC"`, `"NRML"` | `Delivery` |
| `"MTF"` | `Mtf` |
| `"CO"` | `CoverOrder` |
| `"I"`, `"MIS"`, unknown | `Intraday` |

**Order type parsing:**

| Raw | Expected `TradeOrderType` |
|---|---|
| `"LIMIT"` | `Limit` |
| `"SL"` | `StopLoss` |
| `"SL-M"` | `StopLossMarket` |
| anything else | `Market` |

**Order side:** `"SELL"` → `Sell`, `"BUY"` → `Buy`, case-insensitive.

**Validity:** `"IOC"` → `IOC`, else → `Day`.

### `UserRiskState`

| Method | Scenario | Expected |
|---|---|---|
| `IncrementReentryCount` | First call for a symbol | Returns `1` |
| `IncrementReentryCount` | Second call for same symbol | Returns `2` |
| `IncrementReentryCount` | Different symbols are independent | Each starts at `1` |
| `IncrementAutoShiftCount` | Same behavior as above, per chain key | — |
| `MapShiftOrigin` / `ShiftOriginMap` | Set and read back | Round-trips correctly |
| `MarkChainExited` | Mark once, check `ExitedChainKeys` | Contains the key |
| `MarkChainExited` | Mark same key twice | Idempotent, no error |

---

## What is not tested

- `RiskEvaluator` — orchestrates I/O (broker calls, repo, notifier); integration test territory
- `StreamingRiskWorker`, `LtpTickDrainer` — I/O-bound, no pure logic to isolate
- Upstox/Zerodha SDKs — HTTP/WebSocket; mocking would test the mock not the code
- MarketData — same reason
- API endpoints — thin route wiring, integration test territory
