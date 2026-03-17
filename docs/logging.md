# Logging Reference

All backend logging uses the standard .NET `Microsoft.Extensions.Logging` abstractions. Logs go to the console by default. This document is the single reference for every log message emitted across the backend — use it for monitoring, alerting, and troubleshooting.

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
| `Information` | `Starting streaming risk session for userId={UserId}` | Streams are about to connect for this user. |
| `Information` | `Subscribing market data for {Count} instrument(s) — userId={UserId}` | Initial market data subscription after fetching open positions. |
| `Information` | `Streams connected for userId={UserId}; monitoring {Count} open instrument(s)` | Both WebSocket streams are live. Risk engine is active for this user. |
| `Warning` | `Portfolio stream reconnecting for userId={UserId}` | Upstox portfolio WebSocket disconnected; auto-reconnect in progress. |
| `Warning` | `Market data stream reconnecting for userId={UserId}` | Upstox market data WebSocket disconnected; auto-reconnect in progress. |
| `Error` | `Streaming session failed for userId={UserId}` | Unhandled exception in the session. The restart wrapper will retry. |
| `Warning` | `Restarting streaming session for userId={UserId} in {Delay}s` | Session crashed and will restart after the given delay (30s → 60s → 120s → ... → 300s cap). |

#### Trading window

| Level | Message | Meaning |
|---|---|---|
| `Information` | `Market open — risk engine active (window: {Start}–{End} {Tz})` | First evaluation after market open. Logged **once** per open event. |
| `Information` | `Market closed — risk engine paused until {Start} {Tz}` | Market closed or engine started outside hours. Logged **once** per close event. |

#### Portfolio updates

| Level | Message | Meaning |
|---|---|---|
| `Debug` | `Portfolio event received: {EventType} for userId={UserId}` | Raw event type from Upstox (`order_update` / `position_update`). Visible only at Debug level. |
| `Debug` | `Re-fetching positions after portfolio event for userId={UserId}` | REST call about to be made to refresh position cache. |
| `Debug` | `Re-subscribing market data for {Count} instrument(s) — userId={UserId}` | Market data subscription updated after position refresh. |
| `Error` | `Error handling portfolio update for userId={UserId}` | Position re-fetch or subscription failed. Includes exception. |

#### LTP tick evaluation

| Level | Message | Meaning |
|---|---|---|
| `Debug` | `LTP eval rate-limited for userId={UserId} — skipping` | Tick arrived but the minimum interval (`LtpEvalMinIntervalMs`) has not elapsed since last evaluation. Expected and frequent. |
| `Debug` | `Evaluation already in progress for userId={UserId} — skipping` | A concurrent evaluation is running; this tick is dropped to avoid double-evaluation. |
| `Error` | `Error during LTP-triggered evaluation for userId={UserId}` | Evaluation threw unexpectedly. Includes exception. |

---

### `RiskEvaluator`
**Namespace:** `KAITerminal.RiskEngine.Services.RiskEvaluator`

#### Heartbeat (every evaluation cycle)

| Level | Message | Meaning |
|---|---|---|
| `Information` | `[{UserId}]  PnL={Mtm}  SL={Sl}  Target={Target}  TSL=inactive (activates at {Threshold})` | Normal status line. Trailing SL not yet active. Emitted every evaluation cycle. |
| `Information` | `[{UserId}]  PnL={Mtm}  Target={Target}  TSL={Stop}` | Normal status line. Trailing SL is active; shows current stop floor. |
| `Debug` | `Portfolio check skipped for userId={UserId}: already squared off` | User is already exited; no further checks needed. |

#### Risk triggers

| Level | Message | Meaning |
|---|---|---|
| `Warning` | `Hard SL hit for userId={UserId}  MTM={Mtm}  SL={Sl} — exiting all positions` | MTM fell to or below the hard stop loss. Exit sequence initiated. |
| `Information` | `Target hit for userId={UserId}  MTM={Mtm}  Target={Target} — exiting all positions` | MTM reached the profit target. Exit sequence initiated. |
| `Information` | `Trailing SL activated for userId={UserId}  stop locked at={Stop}` | MTM crossed `TrailingActivateAt`; trailing floor is now live. |
| `Information` | `Trailing SL raised for userId={UserId}  stop={Stop}` | MTM advanced by `WhenProfitIncreasesBy`; trailing floor stepped up. |
| `Warning` | `Trailing SL hit for userId={UserId}  MTM={Mtm}  stop={Stop} — exiting all positions` | MTM fell back to the trailing floor. Exit sequence initiated. |

#### Square-off

| Level | Message | Meaning |
|---|---|---|
| `Warning` | `Square-off complete for userId={UserId} — all positions exited` | `ExitAllPositionsAsync` succeeded. All positions should be closed. |
| `Error` | `Failed to exit all positions for userId={UserId} — marked as squared-off to prevent retry loops; manual verification required` | Exit order call failed. The user is **marked as squared-off** to prevent infinite retries. **Operator must verify manually** — positions may be partially or fully open. |
| `Warning` | `Portfolio check: failed to fetch MTM for userId={UserId}` | REST call to get positions failed. This evaluation cycle is skipped entirely; risk checks do not run. |

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

| Scenario | Minimum Level |
|---|---|
| Production monitoring | `Information` |
| Investigating a missed evaluation | `Debug` for `KAITerminal.RiskEngine` |
| Investigating stream parse errors | `Debug` for `KAITerminal.Upstox` |
| Full trace (very verbose) | `Debug` for `Default` |

**Important:** Setting `KAITerminal.Upstox` to `Debug` will emit a log on every rate-limited LTP tick (every 15s per user). In production keep it at `Warning` or `Information`.
