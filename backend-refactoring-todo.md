# Backend Refactoring TODO

Tracked items ordered by priority. Each item is a self-contained task — compile + smoke test after each one.

---

## Phase 1 — Thread-Safety (Fix Correctness Bugs)

- [x] **1.1** `PositionStreamCoordinator` — Replace `_subscribedUpstoxTokens` (HashSet) and `_zerodhaFeedToNative` (Dictionary) with `ConcurrentDictionary`. Eliminate field reassignment in `RefreshSubscriptionsAsync`; use `.Clear()` + bulk add instead.
  - File: `KAITerminal.Api/Hubs/PositionStreamCoordinator.cs`
  - Risk: Race condition between feed handler reads and poll-loop writes

- [x] **1.2** `OptionChainCoordinator` — Replace `_subscribedTokens` (HashSet) with `ConcurrentDictionary<string, bool>` (used as a concurrent set).
  - File: `KAITerminal.Api/Hubs/OptionChainCoordinator.cs`
  - Risk: Race between `SubscribeAsync` and `OnFeedReceived`

- [x] **1.3** `StreamingRiskWorker` — Replace `_sessions` (Dictionary) with `ConcurrentDictionary<string, SessionEntry>`.
  - File: `KAITerminal.RiskEngine/Workers/StreamingRiskWorker.cs`
  - Risk: Race between `SyncSessionsAsync` and concurrent per-user session tasks

- [x] **1.4** `MarketDataService` — Replace `_subscribed` (HashSet + SemaphoreSlim) with `ConcurrentDictionary<string, bool>`. Remove the semaphore (or keep only for WebSocket send serialization).
  - File: `KAITerminal.MarketData/Services/MarketDataService.cs`
  - Risk: `OnFeedReceived` reads `_subscribed` without acquiring the semaphore

---

## Phase 2 — Eliminate Pervasive Duplication

- [x] **2.1** Extract `HttpContextEmailExtensions` — `httpContext.GetUserEmail()` extension method replacing 6+ inline `FindFirst(ClaimTypes.Email)` calls.
  - New file: `KAITerminal.Api/Extensions/HttpContextEmailExtensions.cs`

- [x] **2.2** Extract `IstClock` — static helper with `Now`, `Today`, `ToIst(DateTimeOffset)` replacing 5+ inline `TimeZoneInfo.FindSystemTimeZoneById("Asia/Calcutta")` calls.
  - New file: `KAITerminal.Api/Util/IstClock.cs` (or `KAITerminal.Util/IstClock.cs`)

- [x] **2.3** Extract `EndpointLoggerFactory` helper or switch to typed `ILogger<T>` — removes repeated `lf.CreateLogger("UpstoxEndpoints")` pattern across endpoint files.

---

## Phase 3 — SRP: Split Large Classes

### 3.1 `RiskEvaluator` (280 lines) — pure calculation + side-effect executor

- [x] **3.1a** Extract `RiskDecisionCalculator` — pure static class. Takes `(PortfolioSnapshot, UserRiskConfig, UserRiskState, DateTimeOffset now)`, returns `RiskDecision` record (enum: None / ExitMtmSl / ExitTarget / ExitAutoSquareOff / ExitTrailingSl / UpdateTrailingFloor). No I/O, no DI.
  - New file: `KAITerminal.RiskEngine/Services/RiskDecisionCalculator.cs`

- [x] **3.1b** Extract `TrailingStopCalculator` — pure static: calculates new trailing floor given current MTM + config + existing floor. Returns updated floor value.
  - New file: `KAITerminal.RiskEngine/Services/TrailingStopCalculator.cs`

- [x] **3.1c** Slim down `RiskEvaluator` to thin executor (~80 lines): call `RiskDecisionCalculator`, apply the decision (notify, square off, persist state).
  - File: `KAITerminal.RiskEngine/Services/RiskEvaluator.cs`

### 3.2 `StreamingRiskWorker` (450 lines) — session management + eval loop

- [x] **3.2a** Extract `UserSessionRegistry` — owns `ConcurrentDictionary<string, SessionEntry>` and `SyncSessionsAsync`. ~80 lines.
  - New file: `KAITerminal.RiskEngine/Workers/UserSessionRegistry.cs`

- [x] **3.2b** Extract `LtpTickDrainer` — pure: drains a `Channel<LtpUpdate>`, returns latest-per-token map. No I/O.
  - New file: `KAITerminal.RiskEngine/Workers/LtpTickDrainer.cs`

- [x] **3.2c** Slim down `StreamingRiskWorker` to orchestrator (~150 lines): uses `UserSessionRegistry`, calls `LtpTickDrainer`, delegates to evaluators.
  - File: `KAITerminal.RiskEngine/Workers/StreamingRiskWorker.cs`

### 3.3 `AutoShiftEvaluator` (493 lines) — highest risk, do last in Phase 3

- [x] **3.3a** Extract `AutoShiftDecisionEngine` — pure. Takes positions + state + config, returns `ShiftDecision` record (what to do, for which legs). No broker calls, no state mutation.
  - New file: `KAITerminal.Worker/AutoShiftDecisionEngine.cs`

- [x] **3.3b** Extract `FillPoller` — polls fill confirmation with timeout/retry. Extracted from `WaitForFillAsync`.
  - New file: `KAITerminal.Worker/FillPoller.cs`

- [x] **3.3c** Extract `AutoShiftOrderExecutor` — executes orders (close leg → wait for fill → open new leg). Uses `FillPoller`. Owns all broker calls.
  - New file: `KAITerminal.Worker/AutoShiftOrderExecutor.cs`

- [x] **3.3d** Slim down `AutoShiftEvaluator` to thin orchestrator (~50 lines): reads state, calls `DecisionEngine`, hands off to `OrderExecutor`.
  - File: `KAITerminal.Worker/AutoShiftEvaluator.cs`

### 3.4 `PositionStreamCoordinator` (310 lines)

- [x] **3.4a** Extract `UpstoxFeedSubscriptionManager` — owns Upstox token set, subscribe/unsubscribe from shared market data.
  - New file: `KAITerminal.Api/Hubs/UpstoxFeedSubscriptionManager.cs`

- [x] **3.4b** Extract `ZerodhaFeedSubscriptionManager` — owns zerodha feed-to-native map, `BuildZerodhaFeedMapAsync`, subscribe/unsubscribe.
  - New file: `KAITerminal.Api/Hubs/ZerodhaFeedSubscriptionManager.cs`

- [x] **3.4c** Slim down `PositionStreamCoordinator` to orchestrator (~120 lines): poll loop, route incoming ticks to client, trigger refresh. Uses the two managers.
  - File: `KAITerminal.Api/Hubs/PositionStreamCoordinator.cs`

### 3.5 `UpstoxEndpoints` + `ZerodhaEndpoints` — extract position-shift service

- [x] **3.5a** Extract `PositionShiftService` — encapsulates the ~80-line shift logic (strike gap calc, close old leg, open new leg). Shared by Upstox and Zerodha endpoints.
  - New file: `KAITerminal.Api/Services/PositionShiftService.cs`

- [x] **3.5b** Extract `ByPriceOrderService` — resolves by-price order placement.
  - New file: `KAITerminal.Api/Services/ByPriceOrderService.cs`

- [x] **3.5c** Slim endpoint handlers — call the service, return result. No logic in the lambda.
  - Files: `KAITerminal.Api/Endpoints/UpstoxEndpoints.cs`, `ZerodhaEndpoints.cs`

### 3.6 `WebhookEndpoints` (289 lines)

- [x] **3.6a** Extract `ZerodhaWebhookValidator` — pure static: validates SHA256 checksum. Returns bool.
  - New file: `KAITerminal.Api/Services/ZerodhaWebhookValidator.cs`

- [x] **3.6b** Extract `UpstoxWebhookValidator` — pure static: validates HMAC signature.
  - New file: `KAITerminal.Api/Services/UpstoxWebhookValidator.cs`

- [x] **3.6c** Extract `WebhookOrderProcessor` — resolves user, pushes order toast, triggers position refresh. Shared by both brokers.
  - New file: `KAITerminal.Api/Services/WebhookOrderProcessor.cs`

- [x] **3.6d** Slim `WebhookEndpoints` to: validate → process → 200.
  - File: `KAITerminal.Api/Endpoints/WebhookEndpoints.cs`

### 3.7 `UpstoxMarketDataStreamer` (268 lines)

- [x] **3.7a** Extract `WebSocketFrameReader` — pure: reads and reassembles binary frames into complete messages from a WebSocket.
  - New file: `KAITerminal.MarketData/Services/WebSocketFrameReader.cs`

- [x] **3.7b** Extract `ProtobufFeedDecoder` — pure static: decodes protobuf bytes to domain `FeedUpdate` objects.
  - New file: `KAITerminal.MarketData/Services/ProtobufFeedDecoder.cs`

- [x] **3.7c** Slim `UpstoxMarketDataStreamer` to: connection lifecycle + reconnect loop + subscription management. ~120 lines.
  - File: `KAITerminal.MarketData/Services/UpstoxMarketDataStreamer.cs`

---

## Phase 4 — Readability & Minor Cleanup

- [x] **4.1** `UpsertAsync` methods — extract `MapToEntity(dto, entity)` private helpers in `BrokerCredentialService`, `UserTradingSettingsService`, `RiskConfigService` to remove repetitive property assignment.

- [x] **4.2** `ZerodhaInstrumentService.ParseCsv` (78 lines) — extract `ParseRow(headers, values)` pure method.

- [x] **4.3** `AdminEndpoints` — each route handler (users, stats, risk-logs) should delegate to a service method, not embed 25-line inline logic.

- [x] **4.4** Magic values — add named constants:
  - `IstTimeZone.Id = "Asia/Calcutta"` (or use `IstClock` from 2.2)
  - Exchange prefixes `NSE_FO`, `BSE_FO` as `const string` in one place
  - Reconnect delays, WebSocket buffer sizes
  - `AutoShift` chain key format as a documented builder method

- [x] **4.5** `PositionsHub.OnConnectedAsync` (45 lines) — extract token parsing and coordinator initialization into named private methods.

---

## Notes

- **Build after each item**: `cd backend && dotnet build`
- **No behavior changes** — pure refactoring only
- **AutoShiftEvaluator (3.3)** is the highest-risk item; do it last within Phase 3 after gaining confidence from earlier splits
- The `MarketDataFeedV3.cs` (5171 lines) is protobuf-generated — do not touch
