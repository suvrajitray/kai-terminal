# Design Changes Required

Identified during post-refactor architecture review. Ordered by impact.

---

## 1. Admin token not refreshed on WebSocket reconnect — HIGH

**File:** `backend/KAITerminal.Api/Services/AdminMarketDataService.cs`

**Problem:** `StartAsync` fetches the admin token from DB once and captures it in a closure. On WebSocket auto-reconnect, the original token is reused. If the admin user re-authenticated mid-day (rotating the token), the reconnect will fail silently — all users lose LTP ticks for the rest of the day with no error surfaced.

**Fix:** Subscribe to the `Reconnecting` event on `IMarketDataStreamer`. On each reconnect, re-fetch the latest token from DB via `FetchAdminTokenAsync` and update `UpstoxTokenContext` before the new connection is established. Requires exposing a reconnect hook in `IMarketDataStreamer` or wrapping `ConnectAsync` in a retry loop inside `AdminMarketDataService` that re-reads the token each attempt.

---

## 2. `RedisRiskRepository` uses synchronous Redis calls — HIGH

**File:** `backend/KAITerminal.RiskEngine/State/RedisRiskRepository.cs`
**Interface:** `backend/KAITerminal.RiskEngine/Abstractions/IRiskRepository.cs`

**Problem:** `GetOrCreate`, `Update`, and `Reset` use `db.StringGet` / `db.StringSet` / `db.KeyDelete` — the blocking synchronous StackExchange.Redis API. These block a thread pool thread per call. Under load (many users, frequent evaluations) this causes thread pool starvation.

**Fix:**
- Change `IRiskRepository` methods to return `Task` / `Task<UserRiskState>` (async signatures)
- Update `RedisRiskRepository` to use `StringGetAsync`, `StringSetAsync`, `KeyDeleteAsync`
- Update all callers: `StreamingRiskWorker`, `RiskEvaluator`

---

## 3. `ReentryCounts` silently doesn't round-trip through Redis — MEDIUM

**File:** `backend/KAITerminal.RiskEngine/Models/UserRiskState.cs`

**Problem:** `ReentryCounts` exposes a read-only `IReadOnlyDictionary<string, int>` backed by a private `_reentryCounts` field. `System.Text.Json` cannot populate a read-only property during deserialization — it silently skips it. Re-entry counts are always zero after any Worker restart or config-change-triggered session restart, allowing extra re-entries beyond the configured limit.

**Fix:** Replace private `_reentryCounts` + read-only property with a public `Dictionary<string, int> ReentryCounts { get; set; } = new(StringComparer.Ordinal)`. Add a public `IncrementReentryCount` helper that operates on it. JSON round-trips correctly.

---

## 4. No health signal when admin feed goes silent — MEDIUM

**File:** `backend/KAITerminal.Api/Services/AdminMarketDataService.cs`

**Problem:** If the `AdminMarketDataService` WebSocket stops delivering ticks (network drop, Upstox issue) without triggering a disconnect event, nothing alerts. The risk engine continues evaluating on stale MTM (REST-poll only, no LTP adjustments). No log message, no metric, no notification fires.

**Fix:** Track `_lastTickReceivedAt = DateTimeOffset.UtcNow` in `OnFeedReceived`. Run a background `Task.Delay` loop in `StartAsync` that checks — during market hours — whether `DateTimeOffset.UtcNow - _lastTickReceivedAt > TimeSpan.FromSeconds(60)`. If so, log a warning: `"Admin market data feed appears silent — no ticks in {N}s"`. This feeds into the existing Azure Monitor alert pattern.

---

## 5. `PositionCache.UpdatePositions` has a benign race window — LOW

**File:** `backend/KAITerminal.RiskEngine/State/PositionCache.cs`

**Problem:** `UpdatePositions` does `entry.Ltp.Clear()` then `entry.Positions = positions` as two separate steps with no lock. An LTP tick arriving between the two steps writes into the freshly-cleared dictionary. A concurrent `GetMtm` call between the two steps reads stale `Positions` with empty `Ltp` — falls back to `p.Pnl` only, which is the safe REST-authoritative value. Benign in practice but the window exists.

**Fix (if desired):** Wrap the two-step update in a lightweight lock, or replace `Clear()` + assign with an atomic swap of the entire entry. Low priority since the fallback is safe.

---

## 6. `AdminBroker:BrokerType` config is misleading — LOW (tech debt)

**Files:** `backend/KAITerminal.Api/Services/AdminMarketDataService.cs`, `backend/KAITerminal.Api/appsettings.json`

**Problem:** The config key is used only to look up the right `BrokerCredentials` row in the DB. But `AdminMarketDataService` is hardcoded to Upstox — it always uses `UpstoxTokenContext.Use(token)` and creates an Upstox `MarketDataStreamer`. Setting `AdminBroker:BrokerType = "zerodha"` would fetch a Zerodha token and attempt to open an Upstox WebSocket with it — silent failure.

**Fix:** When a second market data source is added (TrueData, NSE feed), `AdminMarketDataService` should be replaced by a factory pattern: `ISharedMarketDataServiceFactory.Create(brokerType)` returns the appropriate implementation. For now, document the limitation clearly in the config.

---

## 7. Supervisor blocks on slow session stop — LOW

**File:** `backend/KAITerminal.RiskEngine/Workers/StreamingRiskWorker.cs` — `SyncSessionsAsync`

**Problem:** When config changes are detected, `SyncSessionsAsync` cancels the old session and `await Task.WhenAll(toStop...)` before starting the new one. If the old session is blocked on a slow/hung broker API call, the supervisor is delayed for the duration of the call timeout before it can restart with the new config.

**Fix:** Add a `Task.WhenAny(stoppedTasks, Task.Delay(5_000))` timeout so the supervisor doesn't wait more than 5s for sessions to stop. Log a warning if the timeout is hit. The orphaned task will eventually complete on its own.
