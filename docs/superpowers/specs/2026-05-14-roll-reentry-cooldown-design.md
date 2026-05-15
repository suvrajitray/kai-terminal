# Roll Re-entry Cooldown — Design Spec

**Date:** 2026-05-14  
**Status:** Approved

---

## Problem

After a roll, the strategy immediately opens new legs at the new ATM strike. In whipsaw conditions the spot can reverse within seconds, triggering another roll, burning premium repeatedly. A configurable cooldown between closing old legs and opening new ones prevents this.

---

## Scope

Rolling Straddle only. Applies to rolls (spot crosses `RollThresholdPct`). Does not apply to the initial entry or to full exits (MTM SL/target/time).

---

## Config Change

**File:** `KAITerminal.RollingStraddle/Configuration/StrategyConfig.cs`

```csharp
/// <summary>Minutes to wait after a roll before opening new legs. 0 = immediate.</summary>
public int ReEntryDelayMinutes { get; set; } = 15;
```

Default: 15 minutes (one 15-min candle period — standard institutional reference in Indian markets).

---

## State Change

**File:** `KAITerminal.RollingStraddle/Models/StrategyState.cs`

```csharp
public DateTimeOffset? ReEntryAfter { get; set; }
```

Null when no cooldown is active. Set to `now + ReEntryDelayMinutes` immediately after closing rolled legs.

---

## Behaviour Changes

### `HandleRollAsync` (`StrategyRunner.cs`)

Current flow: close old legs → open new legs immediately.

New flow:
1. Close old legs (unchanged).
2. Set `state.ReEntryAfter = DateTimeOffset.UtcNow.AddMinutes(config.ReEntryDelayMinutes)`.
3. Log one line:
   ```
   [IDLE ] Roll complete — cooling off {N} min, next entry at {HH:mm} IST
   ```
4. Return without opening new legs.

### Main loop tick (`StrategyRunner.cs`)

At the top of each evaluation tick, before any roll or entry logic:

```csharp
if (state.ReEntryAfter.HasValue)
{
    if (DateTimeOffset.UtcNow < state.ReEntryAfter.Value)
        continue; // still cooling off — skip tick

    state.ReEntryAfter = null; // cooldown expired, fall through to normal entry
}
```

Normal entry logic then opens new legs at current ATM (existing path — no new entry code needed).

### `MaxRolls` / exit interaction

`RollCount` increments on each roll as today. If `MaxRolls` is reached during the cooldown window, the cooldown clears naturally because no legs exist and the `HoldMaxRolls` / exit path checks `RollCount`, not `ReEntryAfter`. No special interaction needed.

---

## Logging

Single `[IDLE ]` log line emitted once when the cooldown starts. No periodic "X seconds remaining" spam. Time shown in IST (HH:mm).

---

## Configuration Example

`appsettings.json` / user-secrets:
```json
{
  "RollingStraddle": {
    "ReEntryDelayMinutes": 15
  }
}
```

Set to `0` to restore immediate re-entry behaviour.
