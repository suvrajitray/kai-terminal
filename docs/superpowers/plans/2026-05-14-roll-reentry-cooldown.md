# Roll Re-entry Cooldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After closing legs on a roll, wait a configurable number of minutes before opening new legs, preventing whipsaw churn.

**Architecture:** `ReEntryDelayMinutes` is added to `StrategyConfig` (default 15). After closing rolled legs, `HandleRollAsync` sets `state.ReEntryAfter` (a new nullable `DateTimeOffset` on `StrategyState`) instead of immediately calling `OpenLegsAsync`. The main loop checks this field at the top of each tick: if now < `ReEntryAfter`, skip to next tick; once elapsed, clear the field and let normal entry logic re-open legs.

**Tech Stack:** C# / .NET 10, `KAITerminal.RollingStraddle` project

---

## Files

- Modify: `backend/KAITerminal.RollingStraddle/Configuration/StrategyConfig.cs`
- Modify: `backend/KAITerminal.RollingStraddle/Models/StrategyState.cs`
- Modify: `backend/KAITerminal.RollingStraddle/Services/StrategyRunner.cs`

---

### Task 1: Add `ReEntryDelayMinutes` to `StrategyConfig`

**Files:**
- Modify: `backend/KAITerminal.RollingStraddle/Configuration/StrategyConfig.cs`

- [ ] **Step 1: Add the config field**

In `StrategyConfig.cs`, add this property after the `CheckIntervalMs` property (line 53):

```csharp
    /// <summary>Minutes to wait after a roll before opening new legs. 0 = immediate re-entry.</summary>
    public int     ReEntryDelayMinutes { get; set; } = 15;
```

The file should end like this:

```csharp
    /// <summary>Polling interval in milliseconds.</summary>
    public int     CheckIntervalMs  { get; set; } = 5000;

    /// <summary>Minutes to wait after a roll before opening new legs. 0 = immediate re-entry.</summary>
    public int     ReEntryDelayMinutes { get; set; } = 15;
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
cd /path/to/repo/backend && dotnet build KAITerminal.RollingStraddle
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/KAITerminal.RollingStraddle/Configuration/StrategyConfig.cs
git commit -m "feat(rolling-straddle): add ReEntryDelayMinutes config (default 15)"
```

---

### Task 2: Add `ReEntryAfter` to `StrategyState`

**Files:**
- Modify: `backend/KAITerminal.RollingStraddle/Models/StrategyState.cs`

- [ ] **Step 1: Add the non-positional property**

`StrategyState` is a positional record. Add `ReEntryAfter` as a non-positional `init` property so existing `with` expressions and the `Empty` factory remain unchanged.

Replace the entire file content with:

```csharp
using System.Collections.Immutable;

namespace KAITerminal.RollingStraddle.Models;

internal sealed record StrategyState(
    Leg?                     CeLeg,
    Leg?                     PeLeg,
    decimal                  EntrySpot,
    int                      RollCount,
    ImmutableHashSet<string> TradedTokens)
{
    public static readonly StrategyState Empty =
        new(null, null, 0m, 0, ImmutableHashSet.Create<string>(StringComparer.OrdinalIgnoreCase));

    public bool HasOpenLegs => CeLeg is not null && PeLeg is not null;

    public DateTimeOffset? ReEntryAfter { get; init; }
}
```

- [ ] **Step 2: Build to verify no errors**

```bash
cd /path/to/repo/backend && dotnet build KAITerminal.RollingStraddle
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/KAITerminal.RollingStraddle/Models/StrategyState.cs
git commit -m "feat(rolling-straddle): add ReEntryAfter field to StrategyState"
```

---

### Task 3: Set cooldown in `HandleRollAsync` instead of immediately re-entering

**Files:**
- Modify: `backend/KAITerminal.RollingStraddle/Services/StrategyRunner.cs` (lines 220–243)

Currently `HandleRollAsync` calls `OpenLegsAsync` immediately after `CloseLegsAsync`. Change it to set `ReEntryAfter` on the state instead.

- [ ] **Step 1: Replace `HandleRollAsync`**

Replace the entire `HandleRollAsync` method (lines 220–243) with:

```csharp
    private async Task<StrategyState> HandleRollAsync(
        StrategyDecision.Roll r, decimal spot, StrategyState state, MarketSnapshot snapshot, CancellationToken ct)
    {
        _log.LogWarning(Sep);
        _log.LogWarning(
            "  ROLL #{N}  |  Spot {Spot:F2}  Move {Move:+0.00;-0.00}%  from {Entry:F2}",
            r.RollNumber, spot, r.MovePct, state.EntrySpot);
        _log.LogWarning(
            "  CE ₹{Ce:F2}  PE ₹{Pe:F2}  |  P&L at roll {Sign}₹{Pnl:N0}",
            snapshot.CeLtp, snapshot.PeLtp,
            PnlSign(snapshot.Pnl), Math.Abs(snapshot.Pnl));
        _log.LogWarning(Sep);

        _log.LogInformation("[ROLL ] Closing current legs...");
        var closed = await CloseLegsAsync(state, ct);
        var afterRoll = closed with { RollCount = closed.RollCount + 1 };

        if (_cfg.ReEntryDelayMinutes <= 0)
        {
            _log.LogInformation("[ROLL ] Opening new {Type} at Spot {Spot:F2}",
                _cfg.StrikeOffset == 0 ? "straddle" : "strangle", spot);
            var result = await OpenLegsAsync(spot, afterRoll, ct);
            _log.LogInformation(Sep);
            return result;
        }

        var reEntryAt = DateTimeOffset.UtcNow.AddMinutes(_cfg.ReEntryDelayMinutes);
        var reEntryIst = TimeZoneInfo.ConvertTime(reEntryAt, Ist);
        _log.LogInformation(
            "[IDLE ] Roll complete — cooling off {N} min, next {Type} entry at {Time:HH:mm} IST",
            _cfg.ReEntryDelayMinutes,
            _cfg.StrikeOffset == 0 ? "straddle" : "strangle",
            reEntryIst);
        _log.LogInformation(Sep);

        return afterRoll with { ReEntryAfter = reEntryAt };
    }
```

- [ ] **Step 2: Build to verify no errors**

```bash
cd /path/to/repo/backend && dotnet build KAITerminal.RollingStraddle
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/KAITerminal.RollingStraddle/Services/StrategyRunner.cs
git commit -m "feat(rolling-straddle): set ReEntryAfter cooldown in HandleRollAsync"
```

---

### Task 4: Add cooldown gate in the main loop

**Files:**
- Modify: `backend/KAITerminal.RollingStraddle/Services/StrategyRunner.cs` (lines 68–136)

The main loop currently fetches spot and calls `StrategyEngine.Evaluate` every tick. Add a cooldown gate at the very top of the `try` block inside the `while` loop — before the spot fetch — so ticks are skipped cheaply during the wait period. Also guard against the exit window passing during cooldown.

- [ ] **Step 1: Add the cooldown gate**

In `ExecuteAsync`, inside the `while (!ct.IsCancellationRequested)` loop, the first `try` block currently starts with (line 72):

```csharp
                try
                {
                    var spot = await _feed.FetchSpotAsync(ct);
```

Replace the opening of that `try` block so it reads:

```csharp
                try
                {
                    if (state.ReEntryAfter.HasValue)
                    {
                        if (DateTimeOffset.UtcNow < state.ReEntryAfter.Value)
                        {
                            var exitParts = _cfg.ExitTime.Split(':');
                            var exitTime  = new TimeSpan(int.Parse(exitParts[0]), int.Parse(exitParts[1]), 0);
                            if (NowIst() >= exitTime)
                            {
                                _log.LogInformation("[EXIT ] Past exit time during re-entry cooldown — no new entry today");
                                _lifetime.StopApplication();
                                return;
                            }
                            await Delay(ct);
                            continue;
                        }
                        state = state with { ReEntryAfter = null };
                    }

                    var spot = await _feed.FetchSpotAsync(ct);
```

- [ ] **Step 2: Build to verify no errors**

```bash
cd /path/to/repo/backend && dotnet build KAITerminal.RollingStraddle
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/KAITerminal.RollingStraddle/Services/StrategyRunner.cs
git commit -m "feat(rolling-straddle): add cooldown gate in main loop tick"
```

---

### Task 5: Show `ReEntryDelayMinutes` in startup banner

**Files:**
- Modify: `backend/KAITerminal.RollingStraddle/Services/StrategyRunner.cs` (`PrintBanner` method, lines 343–364)

- [ ] **Step 1: Add the delay line to `PrintBanner`**

In `PrintBanner`, after the `VIX filter` log line, add:

```csharp
        _log.LogInformation("  Re-entry delay :  {Delay}",
            _cfg.ReEntryDelayMinutes > 0 ? $"{_cfg.ReEntryDelayMinutes} min after roll" : "immediate");
```

The end of `PrintBanner` should look like:

```csharp
        _log.LogInformation("  VIX filter   :  {Vix}",
            _cfg.VixMaxThreshold > 0 ? $"skip if VIX > {_cfg.VixMaxThreshold}" : "disabled");
        _log.LogInformation("  Re-entry delay :  {Delay}",
            _cfg.ReEntryDelayMinutes > 0 ? $"{_cfg.ReEntryDelayMinutes} min after roll" : "immediate");
        _log.LogInformation(Sep);
```

- [ ] **Step 2: Build final check**

```bash
cd /path/to/repo/backend && dotnet build KAITerminal.RollingStraddle
```

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/KAITerminal.RollingStraddle/Services/StrategyRunner.cs
git commit -m "feat(rolling-straddle): show ReEntryDelayMinutes in startup banner"
```

---

## Manual Verification Checklist

No test project exists. Verify by reading the code:

- [ ] `StrategyConfig.ReEntryDelayMinutes` defaults to `15`
- [ ] `StrategyState.ReEntryAfter` is null in `StrategyState.Empty`
- [ ] After a roll with `ReEntryDelayMinutes > 0`: `HandleRollAsync` returns state with `ReEntryAfter` set and no open legs; one `[IDLE ]` log line is emitted
- [ ] After a roll with `ReEntryDelayMinutes = 0`: existing behaviour — new legs opened immediately, no cooldown path taken
- [ ] During cooldown: main loop ticks skip spot fetch and engine evaluation
- [ ] During cooldown past exit time: app logs `[EXIT ]` and stops cleanly
- [ ] Once cooldown expires: `ReEntryAfter` cleared, `StrategyEngine.EvaluateIdle` called, returns `Enter` if within window → `HandleEntryAsync` opens new legs
- [ ] Startup banner shows `Re-entry delay :  15 min after roll` (or `immediate` if 0)
