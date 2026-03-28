---
tags:
  - architecture
  - caching
  - redis
  - state-management
aliases:
  - Flows
  - State Flows
related:
  - "[[README]]"
  - "[[production-deployment]]"
---

# KAI Terminal — End-to-End Flows & In-Process State

Reference document for all major in-process caches, Redis stores, and pub/sub channels.
Use this when debugging data freshness issues, memory leaks, or cross-process communication.

---

## In-Memory Caches

### 1. `MasterDataService` — `IMemoryCache`

**Project:** `KAITerminal.Api`

| Field | Value |
|---|---|
| **Key** | `contracts:{broker}:{date}` (e.g. `contracts:upstox:2025-03-25`) |
| **Value** | `IReadOnlyList<IndexContracts>` — merged option contracts across brokers |
| **Expiry** | Absolute — **8:15 AM IST daily** (pre-market refresh before the 9:15 open) |

**Notes:**
- Multi-broker merge joins on `ExchangeToken` — the universal cross-broker identifier.
- When both Upstox and Zerodha results are present, `MergeAll` fills both `UpstoxToken` and `ZerodhaToken` on each `ContractEntry`.
- On API restart contracts are re-fetched from the broker on the first request (cache is cold).
- `MasterDataService` injects `IEnumerable<IOptionContractProvider>` — fully broker-agnostic, supports N brokers without modification.

---

### 2. `PositionCache` — `ConcurrentDictionary`

**Project:** `KAITerminal.RiskEngine`

| Field | Value |
|---|---|
| **Key** | `userId` |
| **Value** | See structure below |
| **Expiry** | None — process lifetime |

```
Entry {
  Positions: volatile IReadOnlyList<Position>            // last REST poll snapshot
  Ltp:       ConcurrentDictionary<instrumentToken, decimal>  // live LTP per instrument
}
```

**Notes:**
- `Ltp` dict is **cleared on every `UpdatePositions()` call** — prevents stale prices after a position is closed.
- MTM formula: `p.Pnl + p.Quantity * (liveLtp - p.Ltp)` — broker-authoritative P&L as baseline; live LTP delta applied on each tick.
- This formula is **identical** to the frontend `ReceiveLtpBatch` handler — both compute the same MTM independently.

---

### 3. `PositionStreamCoordinator` — per-connection in-process state

**Project:** `KAITerminal.Api`

```
_subscribedUpstoxTokens: HashSet<string>                       // O(1) feed token filter
_zerodhaFeedToNative:    Dictionary<feedToken, nativeToken>    // reverse map for ReceiveLtpBatch
_lastOrderStatuses:      Dictionary<(broker, orderId), status> // detects order status changes
```

**Lifetime:** Created in `PositionsHub.OnConnectedAsync`; disposed in `PositionStreamManager` on SignalR disconnect.

**Notes:**
- `_zerodhaFeedToNative` is built once on connect from `exchange_token` → `tradingSymbol` lookups via `IZerodhaInstrumentService` (now in `KAITerminal.MarketData.Services` — moved from Zerodha SDK).
- Feed tokens for Zerodha instruments are `NSE_FO|{exchangeToken}` / `BSE_FO|{exchangeToken}` — subscribed to the shared Upstox market-data WebSocket.
- On each `LtpUpdate`, the coordinator translates feed tokens back to native Zerodha trading symbols before pushing `ReceiveLtpBatch` so the frontend `instrumentToken` match works without changes.

---

### 4. `PositionStreamManager` + `IndexStreamManager` — `ConcurrentDictionary`

**Project:** `KAITerminal.Api`

| Manager | Key | Value |
|---|---|---|
| `PositionStreamManager` | `connectionId` | `PositionStreamCoordinator` (`IAsyncDisposable`) |
| `IndexStreamManager` | `connectionId` | `EventHandler<LtpUpdate>` |

**Lifetime:** Entry added on hub connect; removed and disposed on disconnect.

**Notes:**
- `IndexStreamManager` holds only the event handler reference — not a coordinator. Simple unsubscribe on disconnect.
- `ISharedMarketDataService` (shared Upstox WebSocket feed) is subscribed to by both `PositionsHub` and `IndexHub` — they share the **same** WebSocket slot. This is critical: Upstox allows only **2 market data WebSocket connections** per access token (normal users). Slot 1 = `PositionsHub` + `IndexHub` (shared). Slot 2 = `StreamingRiskWorker`.

---

### 5. `StreamingRiskWorker` — `ConcurrentDictionary` + `Dictionary`

**Project:** `KAITerminal.RiskEngine`

```
_gates:    ConcurrentDictionary<userId, UserGate>
           UserGate {
             SemaphoreSlim Semaphore      // serialises concurrent LTP evaluations per user
             long LastLtpEvalTicks        // rate-limit — skips eval if < LtpEvalMinIntervalMs (15s)
           }

_sessions: Dictionary<"{userId}::{brokerType}", SessionEntry>
           SessionEntry {
             CancellationTokenSource Cts
             Task                    Task
             UserConfig              Config
           }
```

**Lifetime:** Supervisor loop re-queries the DB every `UserRefreshIntervalMs` (30 s). Sessions are started/stopped/restarted dynamically as users are enabled or disabled in `UserRiskConfigs`.

**Notes:**
- A session key includes `brokerType` — one session per user per broker (e.g. `user@email.com::upstox`).
- On each DB refresh, new users get a new session; removed users have their `CancellationTokenSource` cancelled.
- `ITokenMapper.EnsureReadyAsync(brokerType, ct)` is called before subscribing: no-op for Upstox; triggers Kite CSV download for Zerodha.

---

## Redis

### 6. `RedisRiskRepository` — Redis string (persistent across restarts)

**Project:** `KAITerminal.RiskEngine`

| Field | Value |
|---|---|
| **Key** | `risk-state:{userId}` |
| **Value** | JSON-serialised `UserRiskState` |
| **Expiry** | Indefinite |

```
UserRiskState {
  LastSessionDate:      DateOnly   // detects new trading day → auto-reset state
  IsSquaredOff:         bool
  TrailingActive:       bool
  TrailingStop:         decimal    // current TSL floor (₹)
  TrailingLastTrigger:  decimal    // MTM at which TSL was last raised
  ReentryCounts:        Dictionary<tradingSymbol, int>
}
```

**Why Redis (not in-memory):**
Survives Worker restarts — prevents TSL re-activation and duplicate square-off within the same trading day. `LastSessionDate` detects a new trading day on startup and resets state automatically.

**Reset:** `ResetAsync(userId)` is called explicitly on risk config change (e.g. user updates their TSL thresholds).

---

### 7. `MarketDataService` + `RedisLtpRelay` — Redis pub/sub

**Projects:** `KAITerminal.MarketData` (owns the WebSocket streamer — `UpstoxMarketDataStreamer`; used by both Worker and Api via `AddMarketDataProducer()` / `AddMarketDataConsumer()`); `KAITerminal.Worker` (Redis publisher via `RedisLtpRelay`); `KAITerminal.Api` (Redis subscriber/relay via `RedisLtpRelay`)

| Channel | Direction | Message format |
|---|---|---|
| `ltp:feed` | Worker → Api | `JSON Dictionary<token, decimal>` — every Upstox WebSocket tick |
| `ltp:sub-req` | Api → Worker | `JSON List<string>` — tokens the Api wants subscribed on the Worker's WebSocket |

**In-memory (Worker only):** `HashSet<string> _subscribed` — currently active feed tokens (avoids redundant subscribe calls).

**No key-value storage** — pub/sub only; no Redis keys are written. Messages are fire-and-forget.

**Flow:**
1. SignalR client connects to `PositionsHub` → `PositionStreamCoordinator` publishes token list to `ltp:sub-req`.
2. Worker's `RedisLtpRelay` receives the request → subscribes new tokens to the Upstox WebSocket.
3. Worker receives Upstox tick → publishes to `ltp:feed`.
4. Api's `RedisLtpRelay` receives tick → forwards to `ISharedMarketDataService` → all connected `PositionStreamCoordinator` instances.

---

### 8. `AppSettingService` — Redis L1 + PostgreSQL L2

**Project:** `KAITerminal.Infrastructure`

| Field | Value |
|---|---|
| **Key** | `appsetting:{key}` (e.g. `appsetting:UpstoxAnalyticsToken`) |
| **Value** | `string` |
| **Expiry** | Indefinite |

**Read-through strategy:**
1. Check Redis — return immediately on hit.
2. Fall back to PostgreSQL `AppSettings` table.
3. Write-through: DB update always precedes Redis update.
4. **Warm-up on Api startup** — `AppSettingService.WarmUpAsync()` pre-populates Redis from DB so the first request never hits Postgres.

---

## Summary Table

| Component | Type | Key format | Value | Expiry |
|---|---|---|---|---|
| `MasterDataService` | `IMemoryCache` | `contracts:{broker}:{date}` | `IReadOnlyList<IndexContracts>` | 8:15 AM IST daily |
| `PositionCache` | `ConcurrentDictionary` | `userId` | positions + LTP map | Process lifetime |
| `PositionStreamCoordinator` | in-process per-connection | — | token maps, order statuses | On SignalR disconnect |
| `PositionStreamManager` | `ConcurrentDictionary` | `connectionId` | coordinator ref | On SignalR disconnect |
| `IndexStreamManager` | `ConcurrentDictionary` | `connectionId` | event handler | On SignalR disconnect |
| `StreamingRiskWorker` | `ConcurrentDictionary` | `userId` / `userId::broker` | gates + sessions | Dynamic (30 s DB refresh) |
| `RedisRiskRepository` | Redis string | `risk-state:{userId}` | JSON `UserRiskState` | Indefinite |
| `UpstoxMarketDataStreamer` (`MarketData`) / `RedisLtpRelay` | Redis pub/sub | `ltp:feed`, `ltp:sub-req` | JSON LTP dict / token list | — (fire-and-forget) |
| `AppSettingService` | Redis L1 + PostgreSQL L2 | `appsetting:{key}` | `string` | Indefinite |
