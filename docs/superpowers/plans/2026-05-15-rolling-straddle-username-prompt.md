# Rolling Straddle Username Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive username prompt at rolling straddle startup so the user can override `Strategy:Username` from appsettings without editing the config file.

**Architecture:** `Program.cs` already has a `Prompt()` helper and a list of startup overrides. A local variable captures the typed username so it is available immediately in the token-fetch section (before `AddInMemoryCollection` applies overrides to `IConfiguration`). The value is also added to `overrides` so `StrategyConfig.Username` reflects it for the rest of the session.

**Tech Stack:** C# / .NET 10, `KAITerminal.RollingStraddle` project

---

## Files

- Modify: `backend/KAITerminal.RollingStraddle/Program.cs`

---

### Task 1: Add username prompt and wire it into the token section

**Files:**
- Modify: `backend/KAITerminal.RollingStraddle/Program.cs`

**NOTE: Do not commit. The user will review and commit manually.**

- [ ] **Step 1: Add the `promptedUsername` variable and prompt**

After the `PickInstrument` call (line 23) and before the expiry `Prompt(...)` (line 27), insert:

```csharp
    string? promptedUsername = null;
    Prompt("Username (Enter to use appsettings value): ",
        v => { promptedUsername = v; overrides.Add(new("Strategy:Username", v)); });
```

The block should look like this in context:

```csharp
    var inst = PickInstrument(builder.Configuration);
    overrides.Add(new("Strategy:Underlying", inst.Underlying));
    overrides.Add(new("Strategy:LotSize",    inst.LotSize.ToString()));

    string? promptedUsername = null;
    Prompt("Username (Enter to use appsettings value): ",
        v => { promptedUsername = v; overrides.Add(new("Strategy:Username", v)); });

    Prompt("Expiry yyyy-MM-dd (Enter to auto-resolve nearest expiry): ",
        v => overrides.Add(new("Strategy:Expiry", v)));
```

- [ ] **Step 2: Use `promptedUsername` in the token section**

Find the line (currently around line 54) that reads:

```csharp
        var username   = builder.Configuration["Strategy:Username"]   ?? "";
```

Replace it with:

```csharp
        var username   = promptedUsername ?? builder.Configuration["Strategy:Username"] ?? "";
```

- [ ] **Step 3: Build to verify no errors**

```bash
cd /Users/suvra/github/kaiterminal/backend && dotnet build KAITerminal.RollingStraddle
```

Expected: Build succeeded, 0 errors, 0 warnings.

---

## Manual Verification Checklist

- [ ] When a username is typed at startup, `username` variable uses the typed value
- [ ] When Enter is pressed, `username` falls back to `Strategy:Username` from appsettings
- [ ] The empty-username guard (`string.IsNullOrEmpty(username)`) still fires correctly if neither source provides a value
- [ ] `Strategy:Username` in `StrategyConfig` reflects the prompted value after `AddInMemoryCollection` is called (via `overrides`)
