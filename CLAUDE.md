# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Backend (run from `backend/`)

```bash
dotnet build
dotnet run --project KAITerminal.Api      # REST API on HTTPS :5001
dotnet run --project KAITerminal.Worker   # Risk engine — multi-user
dotnet run --project KAITerminal.Console  # Risk engine — single user
dotnet watch --project KAITerminal.Api    # Hot-reload dev server
```

No test project exists.

### Frontend (run from `frontend/`)

```bash
npm install && npm run dev    # Dev server on :3000
npm run build                 # TypeScript check + Vite production build
```

The frontend `@` alias resolves to `frontend/src/`.

---

## Backend Projects

| Project                               | SDK          | Role                                                                                         |
| ------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| `KAITerminal.Api`                     | `Sdk.Web`    | ASP.NET Core REST API — auth, credentials, broker endpoints, SignalR hubs                    |
| `KAITerminal.Worker`                  | `Sdk.Worker` | Multi-user risk engine host — reads enabled users from `UserRiskConfigs` DB table            |
| `KAITerminal.Console`                 | `Sdk`        | Single-user risk engine host — reads `Upstox:AccessToken` from config                        |
| `KAITerminal.RiskEngine`              | Library      | Risk engine — all risk logic, workers, in-memory state                                       |
| `KAITerminal.Contracts`               | Library      | Broker-agnostic domain types, streaming interfaces, option contracts, risk notifications     |
| `KAITerminal.Broker`                  | Library      | `IBrokerClient`, `IBrokerClientFactory`                                                      |
| `KAITerminal.Upstox`                  | Library      | Upstox execution SDK (auth, orders, positions, funds, margin) — no market data               |
| `KAITerminal.Zerodha`                 | Library      | Zerodha execution SDK (auth, orders, positions, funds, margin) — no market data              |
| `KAITerminal.MarketData`              | Library      | Option chain/contracts, quotes, candles, WebSocket feed, Kite CSV — zero Upstox/Zerodha deps |
| `KAITerminal.Infrastructure`          | Library      | EF Core `AppDbContext`, PostgreSQL                                                           |
| `KAITerminal.Auth` / `Types` / `Util` | Library      | OAuth/JWT helpers, shared types, utilities                                                   |

**Dependency graph:**

```
Contracts (leaf)
    ↑
Broker → Upstox, Zerodha
MarketData (Contracts + Infrastructure)
    ↑
RiskEngine (Contracts + Broker; zero Upstox/Zerodha/MarketData deps)
Api    (all above + Auth)
Worker (RiskEngine + Upstox + Zerodha + MarketData + Infrastructure)
Console ──► RiskEngine
```

Adding a new broker: create `KAITerminal.{Broker}`, implement `IBrokerClient`, register in `BrokerExtensions`. Add `IOptionContractProvider` to `KAITerminal.MarketData`. Zero changes to RiskEngine/Broker/Contracts.

---

## Architecture

### API (`KAITerminal.Api`)

- Minimal-API style — no controllers. `Extensions/` wires services; `Endpoints/` maps route groups.
- **Auth flow**: Google OAuth → if `IsActive=false` redirect to `/auth/inactive` (no JWT) → if active issue JWT with `isActive`+`isAdmin` claims → redirect to `/auth/callback?token=<jwt>`.
- **User access control** — new users start `IsActive=false`. `suvrajit.ray@gmail.com` auto-activated as admin on first login.
- **Token context middleware** — `/api/upstox/*` reads `X-Upstox-Access-Token` → `UpstoxTokenContext.Use(token)`; `/api/zerodha/*` reads both headers → `ZerodhaTokenContext.Use(apiKey, token)`.
- **Zerodha live LTP** — sourced from shared Upstox market-data feed via `exchange_token` mapping. Zerodha portfolio/order streaming is **stubbed**.
- **Risk events** — `POST /api/internal/risk-event` (validated by `X-Internal-Key`) forwards `RiskNotification` from Worker to user's SignalR group (`/hubs/risk`). `Api:InternalKey` must match in both Api and Worker secrets.
- **Order webhooks** — `POST /api/webhooks/zerodha/order?apiKey={key}` and `POST /api/webhooks/upstox/order`. Zerodha: routed by API key (unique per Kite app), verified via SHA256 checksum. Upstox: verified via `X-Api-Verify-Token` HMAC, user resolved by `BrokerUserId` DB lookup (requires users to have re-authenticated after the `BrokerUserId` column migration). Both push instant order-status toasts + position refresh to connected frontend clients via `PositionStreamCoordinator`.
- `Frontend:Url` controls CORS + OAuth redirect.

### API Response Layer

All `/api/{broker}/positions` and `/api/{broker}/orders` use unified camelCase DTOs — never broker-specific types. Broker identified by URL path only.

API enums always use `[JsonConverter(typeof(JsonStringEnumConverter))]` — strings, never numbers.

`Mapping/PositionMapper.cs` — never import `KAITerminal.Upstox.Models.Enums`; use only `KAITerminal.Api.Dto.Enums` types.

**API folder layout (key areas):**
- `Dto/Enums/` + `Dto/Responses/` — wire types for HTTP boundary (`KAITerminal.Api.Dto.*`). Distinct from the `KAITerminal.Contracts` project (domain types).
- `Hubs/` — SignalR hubs + all hub-adjacent classes: `PositionStreamCoordinator`, `UpstoxFeedSubscriptionManager`, `ZerodhaFeedSubscriptionManager`, stream managers.
- `Services/` — scoped/singleton services: `PositionShiftService`, `ByPriceOrderService`, `WebhookOrderProcessor`, `ZerodhaWebhookValidator`, `UpstoxWebhookValidator`, `AdminService`.
- `Extensions/` — `HttpContextEmailExtensions` (`GetUserEmail()`), `IstClock` (`Now`, `Today`, `ToIst()`, `DateToUtc()`).

**`PositionStreamCoordinator`** is split into three collaborating classes in `Hubs/`:
- `UpstoxFeedSubscriptionManager` — owns Upstox token set, subscribe/unsubscribe from `MarketDataService`.
- `ZerodhaFeedSubscriptionManager` — owns zerodha feed-to-native map, `BuildZerodhaFeedMapAsync`.
- `PositionStreamCoordinator` (orchestrator) — poll loop, routes ticks to client, triggers refresh.

### Upstox SDK (`KAITerminal.Upstox`)

- `UpstoxTokenContext` (`AsyncLocal<string?>`) is the **only** token injection mechanism — never add `accessToken` params to service/facade methods.
- OAuth credentials are **never** stored in `UpstoxConfig` — always passed as method params to `GenerateTokenAsync`.
- API errors → `UpstoxException`; WebSocket errors → `Disconnected` event (never thrown).
- `UpstoxHttpClient` is `internal` — expose new functionality via a public interface in DI.
- `UpstoxClient.Auth` is typed as `IUpstoxAuthService` (extends `IBrokerAuthService`). Use `GenerateTokenWithUserIdAsync` when you need both the access token and the Upstox `user_id` in one call.

### Zerodha SDK (`KAITerminal.Zerodha`)

- `ZerodhaTokenContext` — `AsyncLocal<(string ApiKey, string AccessToken)?>`. Use `ZerodhaTokenContext.Use(apiKey, accessToken)`.
- **Position token**: `InstrumentToken = TradingSymbol` (e.g. `NIFTY2641320700PE`) throughout the stack — not a numeric ID.
- **Product quirk**: NRML positions exit back as `"NRML"` (not `"CNC"`) — `ZerodhaPositionService.MapProductBack` preserves this.
- Broker streaming is **stubbed** — `KiteTickerStreamer`/`ZerodhaPortfolioStreamer` never fire events. LTP arrives via shared Upstox feed.
- `ZerodhaClient.Auth` is typed as `IZerodhaAuthService` (extends `IBrokerAuthService`). Use `GenerateTokenWithUserIdAsync` when you need both the access token and the Zerodha `user_id` (client ID, e.g. `AB1234`).

### MarketData (`KAITerminal.MarketData`)

Zero deps on Upstox/Zerodha SDKs. `UpstoxMarketDataHttpClient` takes an explicit `string token` on every method — no ambient context.

**DI pattern for singletons needing `IAppSettingService`** (scoped/EF): inject `IServiceScopeFactory`, create a scope per call to resolve `IAppSettingService`. Used in `MarketQuoteService`, `ChartDataService`, option providers, and `MarketDataService`.

**`UpstoxMarketDataStreamer` is split into three classes in `Streaming/`:**
- `WebSocketFrameReader` — pure. Reads and reassembles binary WebSocket frames into complete messages.
- `ProtobufFeedDecoder` — pure static. Decodes raw protobuf bytes into `FeedUpdate` domain objects.
- `UpstoxMarketDataStreamer` (connection manager) — connection lifecycle, reconnect loop, subscription management.
- `UpstoxFeedMode` — internal 4-value enum (`Ltpc / Full / OptionGreeks / FullD30`) for the Upstox WebSocket protocol. Distinct from `KAITerminal.Contracts.Streaming.FeedMode` (the public 2-value API enum).

`MarketDataFeedV3.cs` (protobuf-generated, 5000+ lines) — **never edit manually**.

### Risk Engine (`KAITerminal.RiskEngine`)

**Risk evaluation is split across three classes:**
- `RiskDecisionCalculator` — pure static. Takes `(PortfolioSnapshot, UserRiskConfig, UserRiskState, DateTimeOffset now)`, returns a `RiskDecision` record (enum: `None / ExitMtmSl / ExitTarget / ExitAutoSquareOff / ExitTrailingSl / UpdateTrailingFloor`). No I/O.
- `TrailingStopCalculator` — pure static. Computes the new trailing floor given current MTM + config + existing floor.
- `RiskEvaluator` (thin executor) — calls `RiskDecisionCalculator`, then applies the decision: notify, square off, persist state.

**`RiskDecisionCalculator` checks (in order):**

1. MTM SL (`MtmSl`) → `ExitMtmSl`
2. MTM target (`MtmTarget`) → `ExitTarget`
3. Auto square-off: `AutoSquareOffEnabled` + `AutoSquareOffTime` (IST, 24h) from `UserTradingSettings` → `ExitAutoSquareOff` when current IST time ≥ configured time
4. Trailing SL: activates at `TrailingActivateAt`; floor locked at `LockProfitAt`; raised by `IncreaseTrailingBy` every `WhenProfitIncreasesBy`; fires when MTM ≤ floor → `ExitTrailingSl` or `UpdateTrailingFloor`

**`WatchedProducts` filter** — per-broker setting `"All" | "Intraday" | "Delivery"` (default `"All"`). The Worker filters positions by this value **before** `UpdatePositions`, so MTM, SL, trailing stop, and auto-shift only see the watched product type. Terminal display is **unaffected** — `PositionStreamCoordinator` subscribes all instruments regardless. `ProductTypeFilter` (in `KAITerminal.Contracts/Domain/`) normalises broker-specific raw values: Upstox `"I"`/`"D"` and Zerodha `"MIS"`/`"NRML"`; CO/MTF/CNC positions are excluded when any filter is active.

**`SquareOffAsync`** — always fetches fresh positions directly from the broker (never trusts the in-process cache), filters by `WatchedProducts`, exits sell positions first (`Quantity < 0` ordered before buys) to avoid margin spikes, then marks `IsSquaredOff = true`. `SquareOffComplete` notification only fires when at least one position was actually exited.

**Auto-shift chain key** format: `"{underlying}_{expiry}_{optionType}_{strike}"` (e.g. `NIFTY_2026-04-17_PE_22000`). Each original position leg has its own independent shift counter. `ShiftOriginMap` maps shifted-into instrument token → original chain key so the counter is inherited across strikes; for Zerodha the `"NFO|"` exchange prefix is stripped before storing so the map key matches `position.InstrumentToken`. `ExitedChainKeys` in `UserRiskState` guards against duplicate exhausted-exit orders being placed on repeated LTP ticks before the 10-second position poll refreshes the cache.

**`StreamingRiskWorker` is split across three classes in `Workers/`:**
- `UserSessionRegistry` — owns `ConcurrentDictionary<string, SessionEntry>` and `SyncSessionsAsync`. Starts/stops per-user sessions.
- `LtpTickDrainer` — pure static. Drains a `Channel<LtpUpdate>` and returns the latest-per-token map.
- `StreamingRiskWorker` (orchestrator) — uses `UserSessionRegistry`, calls `LtpTickDrainer`, delegates to evaluators.

`InMemoryRiskRepository` state **resets on host restart**. `IRiskEventNotifier` — `NullRiskEventNotifier` is default; hosts override before calling `AddRiskEngine`.

### Worker (`KAITerminal.Worker`)

**Auto-shift is split across four classes in `AutoShift/`:**
- `AutoShiftDecisionEngine` — pure. Takes positions + state + config, returns an `AutoShiftDecision` record (`Kind`: `Shift / ExitExhausted / SkipContractNotFound / SkipUnknownUnderlying`). No broker calls.
- `FillPoller` — polls for fill confirmation with timeout/retry. Extracted from the former `WaitForFillAsync`.
- `AutoShiftOrderExecutor` — executes orders: close leg → wait for fill (via `FillPoller`) → open new leg. Owns all broker calls.
- `AutoShiftEvaluator` (thin orchestrator) — reads state, calls `DecisionEngine`, hands off to `OrderExecutor`.

**Worker folder layout:**
- `AutoShift/` — all auto-shift classes above.
- `TokenSources/` — `DbUserTokenSource`, `ConfigTokenSource`.
- `Jobs/` — `IvSnapshotJob`.
- `Mapping/` — `CrossBrokerTokenMapper`.
- `WorkerIndexKeys.cs` — shared `UnderlyingFeedKeys` dictionary (underlying name → Upstox feed key). Single source of truth used by `AutoShiftDecisionEngine` and `StreamingRiskWorker`.

### Worker Token Mapping

`CrossBrokerTokenMapper`: `exchange_token` is the universal cross-broker instrument identifier (same value on Upstox and Zerodha). Upstox feed token = `"{prefix}|{exchange_token}"`. Mapping uses only 2 public Kite CSV downloads — no Upstox API calls. Cache refreshes at IST midnight.

### Data Storage

PostgreSQL via Neon. Tables auto-created on first start; **new tables require manual `CREATE TABLE` on Neon**.

| Table                 | Purpose                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `BrokerCredentials`   | Per-user credentials. Unique on `(Username, BrokerName)`. Includes `BrokerUserId VARCHAR` (nullable) — stores the broker-native user ID (Upstox `user_id`, Zerodha client ID like `AB1234`). **Requires manual migration:** `ALTER TABLE "BrokerCredentials" ADD COLUMN "BrokerUserId" VARCHAR;` Users must re-authenticate once to populate it. |
| `UserTradingSettings` | Per-user trading preferences. Includes `AutoSquareOffEnabled` (bool) + `AutoSquareOffTime` (varchar "HH:mm"). **Requires manual migration — see `TODO.md`.** |
| `AppUsers`            | `Email`, `Name`, `IsActive`, `IsAdmin`                                                                       |
| `UserRiskConfigs`     | PP/risk config. Unique on `(Username, BrokerType)`. Includes `WatchedProducts VARCHAR NOT NULL DEFAULT 'All'`. **Requires manual migration:** `ALTER TABLE "UserRiskConfigs" ADD COLUMN "WatchedProducts" VARCHAR NOT NULL DEFAULT 'All';` |

Option contracts: not in DB. `MasterDataService` caches in `IMemoryCache`, expires at **8:15 AM IST** daily. Multi-broker merge joins on `ExchangeToken`.

---

## Configuration

| File                                   | Key settings                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `KAITerminal.Api/appsettings.json`     | `Jwt:*`, `GoogleAuth:*`, `Frontend:Url`, `Upstox:ApiBaseUrl/HftBaseUrl`, `ConnectionStrings:DefaultConnection`, `AiSentiment:*` |
| `KAITerminal.Worker/appsettings.json`  | `Upstox:*`, `RiskEngine:*`, `Api:BaseUrl`, `Api:InternalKey`, `ConnectionStrings:DefaultConnection`                             |
| `KAITerminal.Console/appsettings.json` | `Upstox:AccessToken`, `RiskEngine:*`                                                                                            |
| `frontend/.env`                        | `VITE_API_URL`, PP defaults (`VITE_PP_MTM_TARGET`, etc.)                                                                        |

Use `dotnet user-secrets` for all real tokens. `Api:InternalKey` must match in both Api and Worker. App Insights is optional — empty `ConnectionString` = no-op.

---

## Frontend (`frontend/src`)

- React Router v7. `ProtectedRoute` checks JWT expiry + `isActive` claim on every render.
- Zustand stores in `stores/` — auth + brokers persisted to `localStorage`. **PP store is not persisted** — loaded from `GET /api/risk-config` on mount.
- `lib/logout.ts` — `performLogout()` is the single source of truth for logout. Use it everywhere.
- `api-client.ts` — aborts requests on expired token; calls `performLogout()` on `401`.
- Live positions via `@microsoft/signalr` → `PositionsHub`. Zerodha positions merged via REST on connect; LTP arrives via `ReceiveLtpBatch`.
- **Index hub** (`/hubs/indices`) — no token in URL; backend resolves analytics token internally. Works for all users.
- **Option contracts** — `GET /api/masterdata/contracts` unified endpoint. `getByInstrumentKey()` matches Upstox on `upstoxToken`, Zerodha on `zerodhaToken === tradingSymbol`.
- **PP toggle** — optimistic update. `useProfitProtection` is display-only; actual exits fired by the Worker.
- **Always use shadcn components** over native HTML. Add new ones with `npx shadcn add <component>`.
- **Supported indices**: NIFTY, SENSEX, BANKNIFTY, FINNIFTY, BANKEX. Upstox keys: `NSE_INDEX|Nifty 50`, `BSE_INDEX|SENSEX`, `NSE_INDEX|Nifty Bank`, `NSE_INDEX|Nifty Fin Service`, `BSE_INDEX|BANKEX`.
- **Portfolio Greeks** (`use-portfolio-greeks.ts`) — `usePortfolioGreeks(positions)` groups open positions by `(underlying, expiry)`, fetches option chain per group via `fetchOptionChain`, re-fetches every 60 s. Returns `{ netDelta, thetaPerDay }`. Delta coloring for sellers: `|Δ|≤0.1` green, `|Δ|≤0.5` amber, `|Δ|>0.5` red. Theta: positive = green (earning decay), negative = red.
- **Payoff chart** (`payoff-chart-dialog.tsx`) — P&L at expiry, grouped by expiry date. Each expiry gets its own colored curve (cyan, amber, violet, emerald). Uses the live spot price from `useIndicesFeed`. Spot dot and summary rows per expiry group. Separate `legs/indexName` memo (no feed dependency) vs. spot read inline.
- **Bulk exit by type** — when no rows are selected, "Exit CEs" (red) and "Exit PEs" (green) buttons appear in the positions toolbar.
- **Margin utilization gauge** — `MarginEntry` in stats bar shows a color gauge only when both `availableMargin` and `usedMargin` are non-null. Green ≤ 50%, amber ≤ 80%, red > 80%.
- **Auto square-off settings** — `UserTradingSettingsDialog` has a Switch + time Input. Backend stores in `UserTradingSettings`; `TokenSources/DbUserTokenSource` joins and populates `UserConfig`; evaluated in `RiskDecisionCalculator` as check #3.
- **WatchedProducts toggle** — PP panel (first tab, top of form) shows a 3-button toggle: "All positions" / "MIS only" / "NRML only". Bound to `draft.watchedProducts`, saved with the rest of the config on submit. Backend scopes the risk engine to that product type; terminal display is unaffected.

---

## User Trading Profile

Built **primarily for options sellers**:

- **PE = green**, **CE = red** — from the seller's perspective (seller profits when price stays away from strike)
- All colour coding, icons, and labels from the **seller's point of view**

---

## Git Workflow

**Never run any git operation without explicit user instruction.** Do not suggest committing after completing changes.

- Propose files + message before executing any `git add/commit/push`.

---

## React Component Philosophy

- One thing per component; one primary export per file.
- Co-locate by feature — e.g. `panels/positions-panel/position-row.tsx`.
- Extract `useEffect`-heavy logic into `use*.ts` hooks alongside the component.
- No inline logic in JSX — use variables above the return statement.
- Readable over clever — graspable in under 10 seconds.

---

## UI Design Standard

All frontend UI must be **modern, classy, and beautiful**:

- Prefer shadcn/ui over native HTML. Add with `npx shadcn add <component>`.
- Refined spacing; subtle borders (`border-border/40`); layered backgrounds (`bg-muted/20`, `bg-muted/30`).
- Clear typography hierarchy; tabular numerals for financial data.
- Purposeful colour — green/red for P&L, muted for secondary, primary for interactive.
- Smooth, intentional transitions. Premium financial terminal aesthetic.
