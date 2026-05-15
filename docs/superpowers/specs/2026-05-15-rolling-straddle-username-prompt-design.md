# Rolling Straddle Username Prompt — Design Spec

**Date:** 2026-05-15  
**Status:** Approved

---

## Problem

`Strategy:Username` is currently only read from `appsettings.json`. There is no way to override it at startup without editing the config file. All other strategy parameters (lots, expiry, target, SL, strike offset) already have interactive prompts — username should follow the same pattern.

---

## Scope

`Program.cs` in `KAITerminal.RollingStraddle` only. No other files change.

---

## Behaviour

At startup, after the instrument pick and before the expiry prompt, the user sees:

```
Username (Enter to use appsettings value):
```

- If the user types a value: it overrides `Strategy:Username` for this session and is used for the DB credential lookup.
- If the user presses Enter: `Strategy:Username` from `appsettings.json` is used (existing behaviour).

---

## Implementation

**Step 1 — Capture the prompt value in a local variable**

Add immediately after `PickInstrument`, before the expiry `Prompt(...)`:

```csharp
string? promptedUsername = null;
Prompt("Username (Enter to use appsettings value): ",
    v => { promptedUsername = v; overrides.Add(new("Strategy:Username", v)); });
```

`overrides` is populated so the value flows through to `StrategyConfig.Username` after `AddInMemoryCollection` is called later. The local `promptedUsername` variable is needed because `AddInMemoryCollection` isn't applied until after the token section reads the username.

**Step 2 — Use the local variable in the token section**

At the point where `username` is resolved (currently `builder.Configuration["Strategy:Username"] ?? ""`), change to:

```csharp
var username = promptedUsername ?? builder.Configuration["Strategy:Username"] ?? "";
```

This ensures the prompted value is available immediately, without waiting for `overrides` to be applied to `builder.Configuration`.

---

## No other changes

- `StrategyConfig.Username` already exists — no config model change needed.
- `BrokerName` is not prompted (not requested).
- The empty-input guard (`if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(brokerName))`) continues to validate the resolved value.
