# CLAUDE.md

Guidance for Claude Code when working in this repository.

---

## Commands

```bash
# Backend (from backend/)
dotnet build
dotnet run --project KAITerminal.Api      # REST API on HTTPS :5001
dotnet run --project KAITerminal.Worker   # Risk engine — multi-user
dotnet run --project KAITerminal.Console  # Risk engine — single user
dotnet watch --project KAITerminal.Api    # Hot-reload dev server

# Frontend (from frontend/)
npm install && npm run dev    # Dev server on :3000
npm run build                 # TypeScript check + Vite production build
```

No test project exists. `@` alias resolves to `frontend/src/`.

---

## Backend Projects

| Project | Role |
|---------|------|
| `KAITerminal.Api` | ASP.NET Core REST API — auth, credentials, broker endpoints, SignalR hubs |
| `KAITerminal.Worker` | Multi-user risk engine host — reads enabled users from `UserRiskConfigs` |
| `KAITerminal.Console` | Single-user risk engine host — reads `Upstox:AccessToken` from config |
| `KAITerminal.RiskEngine` | Risk logic library — evaluators, workers, in-memory state |
| `KAITerminal.Contracts` | Broker-agnostic domain types, streaming interfaces, risk notifications (leaf) |
| `KAITerminal.Broker` | `IBrokerClient`, `IBrokerClientFactory` |
| `KAITerminal.Upstox` | Upstox execution SDK — no market data |
| `KAITerminal.Zerodha` | Zerodha execution SDK — no market data |
| `KAITerminal.MarketData` | Option chain, quotes, candles, WebSocket feed, Kite CSV — zero broker SDK deps |
| `KAITerminal.Infrastructure` | EF Core `AppDbContext`, PostgreSQL |
| `KAITerminal.Auth` / `Types` / `Util` | OAuth/JWT helpers, shared types, utilities |

**Dependency graph:** `Contracts` → `Broker` → `Upstox`/`Zerodha`; `MarketData`; `RiskEngine` (no Upstox/Zerodha/MarketData deps); `Api` (all); `Worker` (RiskEngine + Upstox + Zerodha + MarketData).

---

## Architecture — Non-Obvious Rules

### API (`KAITerminal.Api`)

- Minimal-API — no controllers. `Extensions/` wires services; `Endpoints/` maps route groups.
- **Auth**: Google OAuth → `IsActive=false` → `/auth/inactive` (no JWT); active → JWT with `isActive`+`isAdmin` → `/auth/callback?token=<jwt>`. `suvrajit.ray@gmail.com` auto-activated as admin.
- **Token middleware** — `/api/upstox/*`: `X-Upstox-Access-Token` → `UpstoxTokenContext.Use(token)`. `/api/zerodha/*`: both headers → `ZerodhaTokenContext.Use(apiKey, token)`.
- **Risk events** — `POST /api/internal/risk-event` (`X-Internal-Key` validated). `Api:InternalKey` must match in Api and Worker secrets.
- **Webhooks** — Zerodha: routed by API key, verified SHA256 checksum. Upstox: `X-Api-Verify-Token` HMAC, user resolved by `BrokerUserId` DB lookup. Both push toast + position refresh via `PositionStreamCoordinator`.
- **DTOs** — `Api/Dto/Enums/` + `Api/Dto/Responses/` (`KAITerminal.Api.Dto.*`). Never confuse with `KAITerminal.Contracts` (domain types).
- `PositionMapper.cs` — never import `KAITerminal.Upstox.Models.Enums`; use only `KAITerminal.Api.Dto.Enums`.
- API enums always use `[JsonConverter(typeof(JsonStringEnumConverter))]` — strings, never numbers.

### Upstox SDK (`KAITerminal.Upstox`)

- `UpstoxTokenContext` (`AsyncLocal<string?>`) is the **only** token mechanism — never add `accessToken` params to methods.
- OAuth credentials never stored in `UpstoxConfig` — always passed as method params.
- API errors → `UpstoxException`; WebSocket errors → `Disconnected` event (never thrown).
- `UpstoxHttpClient` is `internal`. Use `GenerateTokenWithUserIdAsync` when you need both token + `user_id`.

### Zerodha SDK (`KAITerminal.Zerodha`)

- `ZerodhaTokenContext` — `AsyncLocal<(string ApiKey, string AccessToken)?>`.
- **`InstrumentToken = TradingSymbol`** (e.g. `NIFTY2641320700PE`) throughout the stack — not a numeric ID.
- **Product quirk**: NRML positions exit as `"NRML"` (not `"CNC"`) — `MapProductBack` preserves this.
- Broker streaming is **stubbed** — `KiteTickerStreamer`/`ZerodhaPortfolioStreamer` never fire. LTP arrives via shared Upstox feed.
- Use `GenerateTokenWithUserIdAsync` when you need both token + Zerodha `user_id` (client ID, e.g. `AB1234`).

### MarketData (`KAITerminal.MarketData`)

- `UpstoxMarketDataHttpClient` takes explicit `string token` on every method — no ambient context.
- **DI pattern for singletons needing `IAppSettingService`** (scoped/EF): inject `IServiceScopeFactory`, create a scope per call. Used in `MarketQuoteService`, `ChartDataService`, option providers, `MarketDataService`.
- `UpstoxFeedMode` — internal 4-value enum (`Ltpc/Full/OptionGreeks/FullD30`) for the Upstox WebSocket protocol. Distinct from `KAITerminal.Contracts.Streaming.FeedMode` (the public 2-value API enum).
- `MarketDataFeedV3.cs` (protobuf-generated, 5000+ lines) — **never edit manually**.

### Risk Engine (`KAITerminal.RiskEngine`)

**`RiskDecisionCalculator` checks (in order):**
1. MTM SL (`MtmSl`) → exit all
2. MTM target (`MtmTarget`) → exit all
3. Auto square-off: `AutoSquareOffEnabled` + `AutoSquareOffTime` (IST, 24h) → exit when IST time ≥ configured time
4. Trailing SL: activates at `TrailingActivateAt`; floor locked at `LockProfitAt`; raised by `IncreaseTrailingBy` every `WhenProfitIncreasesBy`; fires when MTM ≤ floor

**`WatchedProducts`** — `"All" | "Intraday" | "Delivery"`. Worker filters before `UpdatePositions`; display is unaffected. `ProductTypeFilter` normalises: Upstox `"I"`/`"D"`, Zerodha `"MIS"`/`"NRML"`; CO/MTF/CNC excluded when filter active.

**`SquareOffAsync`** — always fetches fresh positions from broker (never trusts cache), exits sells first (`Quantity < 0`) to avoid margin spikes, marks `IsSquaredOff = true`. `SquareOffComplete` only fires when at least one position was actually exited.

**Auto-shift chain key** — `"{underlying}_{expiry}_{optionType}_{strike}"` (e.g. `NIFTY_2026-04-17_PE_22000`). `ShiftOriginMap` maps shifted-into token → original chain key (counter inherited across strikes). For Zerodha, strip `"NFO|"` prefix before storing so the key matches `position.InstrumentToken`. `ExitedChainKeys` guards against duplicate exhausted-exit orders on repeated ticks.

`InMemoryRiskRepository` resets on restart. `IRiskEventNotifier` — `NullRiskEventNotifier` by default; hosts override before `AddRiskEngine`.

### Worker Token Mapping

`CrossBrokerTokenMapper`: `exchange_token` is the universal cross-broker ID. Upstox feed token = `"{prefix}|{exchange_token}"`. Uses 2 public Kite CSV downloads only. Cache refreshes at IST midnight.

---

## Data Storage

PostgreSQL via Neon. Tables auto-created on first start; **new tables require manual `CREATE TABLE` on Neon**.

| Table | Key notes |
|-------|-----------|
| `BrokerCredentials` | Unique `(Username, BrokerName)`. `BrokerUserId VARCHAR` (nullable). Migration: `ALTER TABLE "BrokerCredentials" ADD COLUMN "BrokerUserId" VARCHAR;` Users must re-authenticate once. |
| `UserTradingSettings` | `AutoSquareOffEnabled` (bool) + `AutoSquareOffTime` (varchar "HH:mm"). Manual migration required. |
| `AppUsers` | `Email`, `Name`, `IsActive`, `IsAdmin` |
| `UserRiskConfigs` | Unique `(Username, BrokerType)`. `WatchedProducts VARCHAR NOT NULL DEFAULT 'All'`. Migration: `ALTER TABLE "UserRiskConfigs" ADD COLUMN "WatchedProducts" VARCHAR NOT NULL DEFAULT 'All';` |

Option contracts: not in DB. `MasterDataService` caches in `IMemoryCache`, expires **8:15 AM IST** daily.

---

## Configuration

| File | Key settings |
|------|-------------|
| `KAITerminal.Api/appsettings.json` | `Jwt:*`, `GoogleAuth:*`, `Frontend:Url`, `Upstox:ApiBaseUrl/HftBaseUrl`, `ConnectionStrings:*`, `AiSentiment:*` |
| `KAITerminal.Worker/appsettings.json` | `Upstox:*`, `RiskEngine:*`, `Api:BaseUrl`, `Api:InternalKey`, `ConnectionStrings:*` |
| `KAITerminal.Console/appsettings.json` | `Upstox:AccessToken`, `RiskEngine:*` |
| `frontend/.env` | `VITE_API_URL`, PP defaults |

Use `dotnet user-secrets` for all real tokens. `Api:InternalKey` must match in both Api and Worker.

---

## Frontend (`frontend/src`)

- React Router v7. `ProtectedRoute` checks JWT expiry + `isActive` on every render.
- Zustand stores — auth + brokers persisted to `localStorage`. **PP store not persisted** — loaded from `GET /api/risk-config` on mount.
- `lib/logout.ts` — `performLogout()` is the single logout source of truth. Use everywhere; `api-client.ts` calls it on `401`.
- Live positions via SignalR → `PositionsHub`. Zerodha positions merged via REST on connect; LTP via `ReceiveLtpBatch`.
- **Index hub** (`/hubs/indices`) — no token in URL; backend resolves analytics token internally.
- **Option contracts** — `GET /api/masterdata/contracts`. `getByInstrumentKey()` matches Upstox on `upstoxToken`, Zerodha on `zerodhaToken === tradingSymbol`.
- **Supported indices**: NIFTY, SENSEX, BANKNIFTY, FINNIFTY, BANKEX. Upstox keys: `NSE_INDEX|Nifty 50`, `BSE_INDEX|SENSEX`, `NSE_INDEX|Nifty Bank`, `NSE_INDEX|Nifty Fin Service`, `BSE_INDEX|BANKEX`.
- **PP toggle** — optimistic update. `useProfitProtection` is display-only; actual exits fired by Worker.
- **Always use shadcn components** — `npx shadcn add <component>`.
- **PE = green, CE = red** — seller's perspective throughout all colour coding and labels.
- UI: refined spacing, subtle borders (`border-border/40`), layered backgrounds (`bg-muted/20`), tabular numerals for financial data, premium terminal aesthetic.

---

## Git Workflow

**Never run any git operation without explicit user instruction.**

- Propose files + message before any `git add/commit/push`.
