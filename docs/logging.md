# Logging Reference

All backend logging uses the standard .NET `Microsoft.Extensions.Logging` abstractions with **Azure Application Insights** as the remote sink. Logs go to both the console and App Insights when a connection string is configured. This document is the single reference for every log message emitted across the backend — use it for monitoring, alerting, and troubleshooting.

---

## Azure Application Insights

### Setup

App Insights is wired up in all three host projects (`Api`, `Worker`, `Console`) via:

- **API** — `Microsoft.ApplicationInsights.AspNetCore 3.0.0` → `AddApplicationInsightsTelemetry()`
- **Worker / Console** — `Microsoft.ApplicationInsights.WorkerService 3.0.0` → `AddApplicationInsightsTelemetryWorkerService()`

App Insights registration is **guarded by a connection string check** in each `Program.cs` — the SDK is only registered when `ApplicationInsights:ConnectionString` is non-empty. When unset, all logs fall back to console only and local development requires no configuration. (Note: `Microsoft.ApplicationInsights` v3.x uses the Azure Monitor OpenTelemetry exporter internally, which throws at startup if registered with an empty connection string — the guard prevents this.)

Set the connection string via `dotnet user-secrets` (never commit it):

```bash
# Run from each project directory
dotnet user-secrets set "ApplicationInsights:ConnectionString" "InstrumentationKey=xxx;IngestionEndpoint=https://..."
```

The connection string is found in the Azure portal under your Application Insights resource → **Overview** → **Connection String**.

### How ILogger maps to App Insights telemetry

| `ILogger` call | App Insights telemetry type |
|---|---|
| `LogDebug` / `LogInformation` / `LogWarning` | **Trace** (with corresponding severity level) |
| `LogError` / `LogCritical` | **Exception** (includes full stack trace) |

All structured log properties (e.g. `{UserId}`, `{Mtm}`) are promoted to custom dimensions in App Insights, making them filterable and searchable in Log Analytics.

### Dual-sink log levels

The console and App Insights sinks have independent log level filters. Console is verbose for local visibility; App Insights is selective to reduce noise and cost.

**Console** — controlled by `Logging:LogLevel`
**App Insights** — controlled by `Logging:ApplicationInsights:LogLevel`

#### Worker / Console projects

```json
"Logging": {
  "LogLevel": {
    "Default": "Information",
    "KAITerminal.RiskEngine": "Information",
    "KAITerminal.Upstox": "Warning"
  },
  "ApplicationInsights": {
    "LogLevel": {
      "Default": "Warning",
      "KAITerminal.RiskEngine": "Information",
      "KAITerminal.Upstox": "Warning"
    }
  }
}
```

App Insights receives all `KAITerminal.RiskEngine` logs at `Information+` — this includes:
- Session lifecycle (start, stop, restart)
- Trading window transitions (market open/close)
- Risk evaluation heartbeat (~every 15s per user during market hours)
- All risk triggers (SL hits, target hits, trailing SL changes)
- Square-off results

The 15-second heartbeat is intentionally included. It enables **Azure Monitor availability alerts** — e.g. "alert if no heartbeat for more than 20 minutes during market hours (09:15–15:30 IST)".

#### API project

```json
"ApplicationInsights": {
  "LogLevel": {
    "Default": "Warning"
  }
}
```

App Insights receives `Warning+` from the API — Upstox API errors, hub errors, and all unhandled exceptions with full stack traces.

### Suggested Azure Monitor alerts

| Alert | Query | Threshold |
|---|---|---|
| Risk engine down during market hours | `traces \| where message contains "Market open"` missing for 20 min | 0 results in 20 min window |
| Square-off failure | `traces \| where severityLevel >= 3 and message contains "Failed to exit"` | Any occurrence |
| Stream permanently disconnected | `traces \| where message contains "permanently disconnected"` | Any occurrence |
| Session crash loop | `traces \| where message contains "Restarting streaming session"` | > 3 in 10 min |
| High API error rate | `exceptions \| where outerMessage contains "Upstox"` | > 10 in 5 min |

---

## Log Level Configuration

Log levels are configured per namespace in each project's `appsettings.json`. The most useful overrides:

**`backend/KAITerminal.Worker/appsettings.json`**
```json
"Logging": {
  "LogLevel": {
    "Default": "Information",
    "Microsoft.Hosting.Lifetime": "Information",
    "KAITerminal.RiskEngine": "Information",
    "KAITerminal.Upstox": "Warning"
  }
}
```

**`backend/KAITerminal.Api/appsettings.json`**
```json
"Logging": {
  "LogLevel": {
    "Default": "Information",
    "Microsoft.AspNetCore": "Warning"
  }
}
```

### Enabling verbose debug output

To see all internal state (rate-limited skips, gate contention, portfolio event types, parse errors):

```json
"KAITerminal.RiskEngine": "Debug",
"KAITerminal.Upstox": "Debug"
```

You can also override via environment variable without editing files:

```bash
Logging__LogLevel__KAITerminal__RiskEngine=Debug
Logging__LogLevel__KAITerminal__Upstox=Debug
```

---

## Log Catalog

### `StreamingRiskWorker`
**Namespace:** `KAITerminal.RiskEngine.Workers.StreamingRiskWorker`

#### Startup

| Level | Message | Meaning |
|---|---|---|
| `Information` | `StreamingRiskWorker started — LTP eval interval={IntervalMs}ms trading window={Start}–{End} {Tz}` | Worker host started. Confirms configured trading window and evaluation rate. |
| `Warning` | `StreamingRiskWorker: no users configured — nothing to monitor` | No enabled rows in `UserRiskConfigs`. Worker exits immediately. Check DB. |
| `Information` | `Starting risk sessions for {Count} user(s)` | Number of users loaded from DB. One task is launched per user. |
| `Information` | `StreamingRiskWorker stopped` | Host shutdown complete. |

#### Per-user session lifecycle

| Level | Message | Meaning |
|---|---|---|
| `Information` | `Starting streaming risk session for userId={UserId} broker={Broker}` | Streams are about to connect for this user. |
| `Information` | `Subscribing market data for {Count} instrument(s) — userId={UserId} broker={Broker}` | Initial market data subscription after fetching open positions. |
| `Information` | `Streams connected for userId={UserId} broker={Broker}; monitoring {Count} open instrument(s)` | Both WebSocket streams are live. Risk engine is active for this user. |
| `Warning` | `Portfolio stream reconnecting for userId={UserId} broker={Broker}` | Upstox portfolio WebSocket disconnected; auto-reconnect in progress. |
| `Warning` | `Market data stream reconnecting for userId={UserId} broker={Broker}` | Upstox market data WebSocket disconnected; auto-reconnect in progress. |
| `Error` | `Streaming session failed for userId={UserId} broker={Broker}` | Unhandled exception in the session. The restart wrapper will retry. |
| `Warning` | `Restarting streaming session for userId={UserId} broker={Broker} in {Delay}s` | Session crashed and will restart after the given delay (30s → 60s → 120s → ... → 300s cap). |

#### Trading window

| Level | Message | Meaning |
|---|---|---|
| `Information` | `Market open — risk engine active (window: {Start}–{End} {Tz})` | First evaluation after market open. Logged **once** per open event. |
| `Information` | `Market closed — risk engine paused until {Start} {Tz}` | Market closed or engine started outside hours. Logged **once** per close event. |

#### Portfolio updates

| Level | Message | Meaning |
|---|---|---|
| `Debug` | `Portfolio event received: {EventType} for userId={UserId} broker={Broker}` | Raw event type from Upstox (`order_update` / `position_update`). Visible only at Debug level. |
| `Debug` | `Re-fetching positions after portfolio event for userId={UserId} broker={Broker}` | REST call about to be made to refresh position cache. |
| `Debug` | `Re-subscribing market data for {Count} instrument(s) — userId={UserId} broker={Broker}` | Market data subscription updated after position refresh. |
| `Error` | `Error handling portfolio update for userId={UserId} broker={Broker}` | Position re-fetch or subscription failed. Includes exception. |

#### LTP tick evaluation

| Level | Message | Meaning |
|---|---|---|
| `Debug` | `LTP eval rate-limited for userId={UserId} broker={Broker} — skipping` | Tick arrived but the minimum interval (`LtpEvalMinIntervalMs`) has not elapsed since last evaluation. Expected and frequent. |
| `Debug` | `Evaluation already in progress for userId={UserId} broker={Broker} — skipping` | A concurrent evaluation is running; this tick is dropped to avoid double-evaluation. |
| `Debug` | `Skipping evaluation for userId={UserId} broker={Broker} — outside trading hours` | Evaluation requested but the current time is outside the configured trading window. |
| `Error` | `Error during LTP-triggered evaluation for userId={UserId} broker={Broker}` | Evaluation threw unexpectedly. Includes exception. |

---

### `RiskEvaluator`
**Namespace:** `KAITerminal.RiskEngine.Services.RiskEvaluator`

#### Heartbeat (every evaluation cycle)

| Level | Message | Meaning |
|---|---|---|
| `Information` | `[{UserId}] [{Broker}]  PnL={Mtm}  SL={Sl}  Target={Target}  TSL=inactive (activates at {Threshold})` | Normal status line. Trailing SL not yet active. Emitted every evaluation cycle. |
| `Information` | `[{UserId}] [{Broker}]  PnL={Mtm}  Target={Target}  TSL={Stop}` | Normal status line. Trailing SL is active; shows current stop floor. |
| `Debug` | `Portfolio check skipped for userId={UserId} broker={Broker}: already squared off` | User is already exited; no further checks needed. |

#### Risk triggers

| Level | Message | Meaning |
|---|---|---|
| `Warning` | `Hard SL hit for userId={UserId} broker={Broker}  MTM={Mtm}  SL={Sl} — exiting all positions` | MTM fell to or below the hard stop loss. Exit sequence initiated. |
| `Information` | `Target hit for userId={UserId} broker={Broker}  MTM={Mtm}  Target={Target} — exiting all positions` | MTM reached the profit target. Exit sequence initiated. |
| `Information` | `Trailing SL activated for userId={UserId} broker={Broker}  stop locked at={Stop}` | MTM crossed `TrailingActivateAt`; trailing floor is now live. |
| `Information` | `Trailing SL raised for userId={UserId} broker={Broker}  stop={Stop}` | MTM advanced by `WhenProfitIncreasesBy`; trailing floor stepped up. |
| `Warning` | `Trailing SL hit for userId={UserId} broker={Broker}  MTM={Mtm}  stop={Stop} — exiting all positions` | MTM fell back to the trailing floor. Exit sequence initiated. |

#### Square-off

| Level | Message | Meaning |
|---|---|---|
| `Warning` | `Square-off complete for userId={UserId} broker={Broker} — all positions exited` | `ExitAllPositionsAsync` succeeded. All positions should be closed. |
| `Error` | `Failed to exit all positions for userId={UserId} broker={Broker} — marked as squared-off to prevent retry loops; manual verification required` | Exit order call failed. The user is **marked as squared-off** to prevent infinite retries. **Operator must verify manually** — positions may be partially or fully open. |
| `Warning` | `Portfolio check: failed to fetch MTM for userId={UserId} broker={Broker}` | REST call to get positions failed. This evaluation cycle is skipped entirely; risk checks do not run. |

---

### `PortfolioStreamer`
**Namespace:** `KAITerminal.Upstox.Services.PortfolioStreamer`

| Level | Message | Meaning |
|---|---|---|
| `Warning` | `Portfolio stream reconnect attempt {Attempt}/{Max} failed` | A reconnect attempt failed. Will retry up to `MaxReconnectAttempts`. Includes exception. |
| `Error` | `Portfolio stream failed to reconnect after {Max} attempt(s) — stream permanently disconnected` | All reconnect attempts exhausted. The streamer is dead; the risk engine will no longer receive portfolio events until restart. |
| `Warning` | `Failed to parse portfolio stream message ({Length} bytes)` | Received a JSON frame that could not be deserialized. The message is dropped. Repeated occurrences suggest a protocol change or data corruption. |

---

### `MarketDataStreamer`
**Namespace:** `KAITerminal.Upstox.Services.MarketDataStreamer`

| Level | Message | Meaning |
|---|---|---|
| `Warning` | `Market data stream reconnect attempt {Attempt}/{Max} failed` | A reconnect attempt failed. Will retry up to `MaxReconnectAttempts`. Includes exception. |
| `Error` | `Market data stream failed to reconnect after {Max} attempt(s) — stream permanently disconnected` | All reconnect attempts exhausted. LTP ticks stop; risk evaluations will use stale cached values. Restart required. |
| `Warning` | `Failed to parse market data frame ({Length} bytes)` | Received a protobuf binary frame that could not be decoded. The frame is dropped. Repeated occurrences may indicate a proto schema mismatch. |

---

### `MasterDataService`
**Namespace:** `KAITerminal.Api.Services.MasterDataService`

| Level | Message | Meaning |
|---|---|---|
| `Information` | `MasterData cache hit for broker={Broker}` | Contracts returned from `IMemoryCache` — no broker API call made. |
| `Information` | `MasterData cache miss for broker={Broker}, fetching from broker API` | Cache entry absent or expired; fetching fresh contracts from the broker. Cache is populated and expires at 8:15 AM IST. |

---

### `PositionsHub`
**Namespace:** `KAITerminal.Api.Hubs.PositionsHub`

| Level | Message | Meaning |
|---|---|---|
| `Information` | `Sending ReceiveOrderUpdate: orderId={OrderId} status={Status} symbol={Symbol}` | An order event is being pushed to the frontend client. |
| `Error` | `Error processing portfolio update` | Position re-fetch or SignalR push failed inside the portfolio event handler. The client will miss this update. Includes exception. |
| `Debug` | `LTP push failed for connection {ConnectionId} — client likely disconnected` | `ReceiveLtpBatch` could not be sent. Usually means the browser tab was closed. Visible only at Debug level. |

---

### `IndexHub`
**Namespace:** `KAITerminal.Api.Hubs.IndexHub`

| Level | Message | Meaning |
|---|---|---|
| `Warning` | `Index quotes poll failed for connection {ConnectionId} — skipping tick` | `GetMarketQuotesAsync` failed for this poll cycle. The client's index cards will not update for this interval. Includes exception. |

---

### Global Exception Handler
**Logger name:** `KAITerminal.Api.GlobalExceptionHandler`

| Level | Message | Meaning |
|---|---|---|
| `Warning` | `Upstox API error on {Method} {Path}: {Message}` | An `UpstoxException` propagated from an endpoint. The response body contains the Upstox error message. Includes exception. |
| `Error` | `Unhandled exception on {Method} {Path}` | Any other unhandled exception from an API endpoint. Client receives a generic 500 response. Includes exception with full stack trace. |

---

## Troubleshooting Guide

### Risk engine is not evaluating despite positions being open

1. Check for `Market closed — risk engine paused` — the trading window (`TradingWindowStart`/`TradingWindowEnd`) may be wrong or the timezone (`TradingTimeZone`) is incorrect.
2. Check for `StreamingRiskWorker: no users configured` — the user's `UserRiskConfigs.Enabled` flag may be `false` in the DB.
3. Check for `Market data stream failed to reconnect` — LTP ticks have stopped, so rate-limited evaluations won't fire. Restart the Worker.
4. Check for `already squared off` at Debug level — the user was squared off earlier in the session; state resets only on Worker restart.

### Square-off did not happen / positions still open

1. Find `Hard SL hit` / `Target hit` / `Trailing SL hit` — confirms the trigger fired.
2. Check immediately after for `Square-off complete` or `Failed to exit all positions`.
3. If `Failed to exit all positions` is present — the exit API call failed. **Manually close positions via Upstox.** The engine will not retry (by design — prevents order spam).
4. If neither message appears — the evaluation cycle may not have run. Check for `Market closed` or `no users configured`.

### Stale index prices in the UI

1. Look for `Index quotes poll failed` — recurring failures mean the Upstox quotes API is down or the token has expired.
2. The index ticker polls every 3 seconds; a single failure skips that tick but subsequent polls continue automatically.

### WebSocket streams keep disconnecting

1. Look for `reconnecting` warnings followed by `reconnect attempt N/M failed` warnings.
2. If `stream permanently disconnected` (Error) appears — all retry attempts failed. Restart the Worker or API process.
3. Check if the Upstox access token has expired (daily rotation). The token is captured at stream connect time; a new token requires a Worker restart.
4. Upstox allows **2 market data WebSocket connections** per normal-tier token. A third connection (e.g. a second browser tab on `PositionsHub`) will fail.

### Positions hub client not receiving updates

1. Look for `Error processing portfolio update` — position re-fetch failed. The client's position list is stale.
2. Look for `LTP push failed` at Debug level — the browser tab may have disconnected but the server-side cleanup hasn't fired yet.
3. Check for portfolio stream disconnect/reconnect events — during reconnection, order and position events are not delivered.

### Trailing SL not activating

1. Confirm `TrailingEnabled: true` is set in the user's `UserRiskConfigs` row.
2. Watch the heartbeat log: `TSL=inactive (activates at {Threshold})` — the activation threshold (`TrailingActivateAt`) may not have been reached yet.
3. `Trailing SL activated` will appear exactly once when the threshold is crossed.

### Parse errors on portfolio or market data streams

- `Failed to parse portfolio stream message` — typically caused by an Upstox API schema change. Check the raw JSON format against `PortfolioStreamUpdate`.
- `Failed to parse market data frame` — protobuf schema mismatch. Regenerate `MarketDataFeedV3.cs` from the updated `.proto` file (see `KAITerminal.Upstox/CLAUDE.md`).

---

## Log Level Quick Reference

### Console

| Scenario | Minimum level |
|---|---|
| Normal production | `Information` |
| Investigating a missed evaluation | `Debug` for `KAITerminal.RiskEngine` |
| Investigating stream parse errors | `Debug` for `KAITerminal.Upstox` |
| Full trace (very verbose) | `Debug` for `Default` |

### App Insights (via `Logging:ApplicationInsights:LogLevel`)

| Namespace | Default setting | Why |
|---|---|---|
| `Default` | `Warning` | Avoids noise from framework internals |
| `KAITerminal.RiskEngine` | `Information` | Captures heartbeat + all risk events; enables availability alerting |
| `KAITerminal.Upstox` | `Warning` | Reconnect failures and parse errors only |

**Important:** Setting `KAITerminal.Upstox` to `Debug` in App Insights will emit a trace on every rate-limited LTP tick (~every 15s per user). Keep it at `Warning` in production to avoid excessive telemetry ingestion costs.
