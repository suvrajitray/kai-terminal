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
- `Frontend:Url` controls CORS + OAuth redirect.

### API Response Layer

All `/api/{broker}/positions` and `/api/{broker}/orders` use unified camelCase DTOs — never broker-specific types. Broker identified by URL path only.

API enums always use `[JsonConverter(typeof(JsonStringEnumConverter))]` — strings, never numbers.

`Mapping/PositionMapper.cs` — never import `KAITerminal.Upstox.Models.Enums`; use only API contract enums.

### Upstox SDK (`KAITerminal.Upstox`)

- `UpstoxTokenContext` (`AsyncLocal<string?>`) is the **only** token injection mechanism — never add `accessToken` params to service/facade methods.
- OAuth credentials are **never** stored in `UpstoxConfig` — always passed as method params to `GenerateTokenAsync`.
- API errors → `UpstoxException`; WebSocket errors → `Disconnected` event (never thrown).
- `UpstoxHttpClient` is `internal` — expose new functionality via a public interface in DI.

### Zerodha SDK (`KAITerminal.Zerodha`)

- `ZerodhaTokenContext` — `AsyncLocal<(string ApiKey, string AccessToken)?>`. Use `ZerodhaTokenContext.Use(apiKey, accessToken)`.
- **Position token**: `InstrumentToken = TradingSymbol` (e.g. `NIFTY2641320700PE`) throughout the stack — not a numeric ID.
- **Product quirk**: NRML positions exit back as `"NRML"` (not `"CNC"`) — `ZerodhaPositionService.MapProductBack` preserves this.
- Broker streaming is **stubbed** — `KiteTickerStreamer`/`ZerodhaPortfolioStreamer` never fire events. LTP arrives via shared Upstox feed.

### MarketData (`KAITerminal.MarketData`)

Zero deps on Upstox/Zerodha SDKs. `UpstoxMarketDataHttpClient` takes an explicit `string token` on every method — no ambient context.

**DI pattern for singletons needing `IAppSettingService`** (scoped/EF): inject `IServiceScopeFactory`, create a scope per call to resolve `IAppSettingService`. Used in `MarketQuoteService`, `ChartDataService`, option providers, and `MarketDataService`.

### Risk Engine (`KAITerminal.RiskEngine`)

**`RiskEvaluator` checks (in order):**

1. MTM SL (`MtmSl`) → exit all
2. MTM target (`MtmTarget`) → exit all
3. Auto square-off: `AutoSquareOffEnabled` + `AutoSquareOffTime` (IST, 24h) from `UserTradingSettings` → exit all when current IST time ≥ configured time
4. Trailing SL: activates at `TrailingActivateAt`; floor locked at `LockProfitAt`; raised by `IncreaseTrailingBy` every `WhenProfitIncreasesBy`; fires when MTM ≤ floor

`InMemoryRiskRepository` state **resets on host restart**. `IRiskEventNotifier` — `NullRiskEventNotifier` is default; hosts override before calling `AddRiskEngine`.

### Worker Token Mapping

`CrossBrokerTokenMapper`: `exchange_token` is the universal cross-broker instrument identifier (same value on Upstox and Zerodha). Upstox feed token = `"{prefix}|{exchange_token}"`. Mapping uses only 2 public Kite CSV downloads — no Upstox API calls. Cache refreshes at IST midnight.

### Data Storage

PostgreSQL via Neon. Tables auto-created on first start; **new tables require manual `CREATE TABLE` on Neon**.

| Table                 | Purpose                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `BrokerCredentials`   | Per-user credentials. Unique on `(Username, BrokerName)`.                                                    |
| `UserTradingSettings` | Per-user trading preferences. Includes `AutoSquareOffEnabled` (bool) + `AutoSquareOffTime` (varchar "HH:mm"). **Requires manual migration — see `TODO.md`.** |
| `AppUsers`            | `Email`, `Name`, `IsActive`, `IsAdmin`                                                                       |
| `UserRiskConfigs`     | PP/risk config. Unique on `(Username, BrokerType)`.                                                          |

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
- **Breakeven column** — positions panel shows a `B/E` column. CE breakeven = strike + avg price; PE breakeven = strike − avg price.
- **Bulk exit by type** — when no rows are selected, "Exit CEs" (red) and "Exit PEs" (green) buttons appear in the positions toolbar.
- **Margin utilization gauge** — `MarginEntry` in stats bar shows a color gauge only when both `availableMargin` and `usedMargin` are non-null. Green ≤ 50%, amber ≤ 80%, red > 80%.
- **Auto square-off settings** — `UserTradingSettingsDialog` has a Switch + time Input. Backend stores in `UserTradingSettings`; `DbUserTokenSource` joins and populates `UserConfig`; evaluated in `RiskEvaluator` as check #3.

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
