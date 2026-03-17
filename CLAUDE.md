# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Backend (run from `backend/`)

```bash
dotnet build                              # Build entire solution

# Run hosts
dotnet run --project KAITerminal.Api      # REST API on HTTPS :5001
dotnet run --project KAITerminal.Worker   # Risk engine — multi-user
dotnet run --project KAITerminal.Console  # Risk engine — single user (your own token)

dotnet watch --project KAITerminal.Api    # Hot-reload dev server
```

No test project exists.

### Frontend (run from `frontend/`)

```bash
npm install
npm run dev        # Dev server on :3000
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
```

The frontend `@` alias resolves to `frontend/src/`.

---

## Backend Projects

| Project | SDK | Role |
|---|---|---|
| `KAITerminal.Api` | `Sdk.Web` | ASP.NET Core REST API — auth, credentials, Upstox proxy |
| `KAITerminal.Worker` | `Sdk.Worker` | Multi-user risk engine host — reads enabled users from `UserRiskConfigs` DB table |
| `KAITerminal.Console` | `Sdk` | Single-user risk engine host — reads `Upstox:AccessToken` from config |
| `KAITerminal.RiskEngine` | Library | Risk engine library — all risk logic, workers, state |
| `KAITerminal.Upstox` | Library | Upstox SDK — HTTP client, WebSocket streamers, order/option services |
| `KAITerminal.Infrastructure` | Library | EF Core `AppDbContext`, DB initialisation, PostgreSQL integration |
| `KAITerminal.Auth` | Library | OAuth/JWT service registration helpers |
| `KAITerminal.Types` | Library | Cross-project shared types |
| `KAITerminal.Util` | Library | Shared utilities |

**Dependency graph:**
```
KAITerminal.Api      ──► KAITerminal.Upstox
                     ──► KAITerminal.Infrastructure
                     ──► KAITerminal.Auth ──► KAITerminal.Infrastructure

KAITerminal.Worker   ──► KAITerminal.RiskEngine ──► KAITerminal.Upstox
                     ──► KAITerminal.Infrastructure
KAITerminal.Console  ──► KAITerminal.RiskEngine
```

---

## Architecture

### API (`KAITerminal.Api`)

- `Program.cs` wires services via extension methods in `Extensions/` and maps endpoint groups in `Endpoints/`.
- Minimal-API style — no controllers.
- Auth flow: `GET /auth/google` → Google OAuth → `GET /auth/google/callback` → `UserService.EnsureExistsAsync` creates user if new → if `IsActive=false` redirects to `{Frontend:Url}/auth/inactive` (no JWT) → if active issues JWT with `isActive` + `isAdmin` claims → frontend redirected to `/auth/callback?token=<jwt>`. All subsequent API calls use `Authorization: Bearer <token>`.
- **User access control** — `AppUsers` table gates access. New users are created with `IsActive=false` on first login. `suvrajit.ray@gmail.com` is auto-activated as admin on first login. Inactive users are redirected to `/auth/inactive` before a JWT is issued. `ProtectedRoute` also checks the `isActive` claim from the stored JWT and redirects to `/auth/inactive` if false.
- `BrokerExtensions.AddBrokerServices()` registers `AddUpstoxSdk()`. The API uses `UpstoxTokenContext.Use(token)` per-request to inject the user's Upstox access token into broker calls (passed by frontend as `X-Upstox-AccessToken` header).
- Credentials (`Jwt:Key`, `GoogleAuth:ClientId/Secret`, `ConnectionStrings:DefaultConnection`) and `Frontend:Url` must be set in `appsettings.json` or `dotnet user-secrets` before the API starts.
- `Frontend:Url` (default `http://localhost:3000`) controls CORS allowed origins and the OAuth redirect.
- **Live positions** — `PositionsHub` (`Hubs/PositionsHub.cs`) is a SignalR hub mounted at `/hubs/positions`. On connect it fetches positions, starts per-connection `IPortfolioStreamer` + `IMarketDataStreamer`, and pushes `ReceivePositions` / `ReceiveLtpBatch` / `ReceiveOrderUpdate` messages. `PositionStreamManager` (singleton) tracks streamer pairs by connection ID and disposes them on disconnect.
- **Portfolio stream** — `ConnectAsync` must be called with explicit `UpdateType` values (e.g. `[UpdateType.Order, UpdateType.Position]`); Upstox delivers no events if `update_types` query params are omitted. The Upstox portfolio stream JSON frame uses `update_type` (not `type`) and all fields are flat at the root — there is no nested `data` object.
- **Order update notifications** — `ReceiveOrderUpdate` is pushed to the frontend on every `update_type=order` event. Frontend shows `toast.error` for `rejected` status and `toast.success` for `complete`; the Orders panel auto-refreshes on every order event.
- **Exchange filter** — `GET /api/upstox/positions?exchange=NFO,BFO` and `GET /api/upstox/mtm?exchange=NFO,BFO` accept a comma-separated exchange list; the `PositionsHub` also accepts `?exchange=` on the WebSocket URL. Filtering is applied server-side; omit the param to receive all exchanges. See `docs/live-positions-websocket.md` for full protocol details.

### Upstox SDK (`KAITerminal.Upstox`)

Layered: `UpstoxClient` (facade) → `IPositionService` / `IOrderService` / `IOptionService` / `IAuthService` / `IMarginService` → `UpstoxHttpClient` (internal HTTP layer) → Upstox REST API.

- **`UpstoxTokenContext`** — `AsyncLocal<string?>` ambient token. Use `UpstoxTokenContext.Use(token)` to scope all API calls within the block to a specific user without passing the token explicitly.
- **Three named `HttpClient`s**: `"UpstoxApi"` (read, REST), `"UpstoxHft"` (order writes, lower latency), `"UpstoxAuth"` (OAuth exchange only, no Bearer header).
- Register with `services.AddUpstoxSdk(configuration)` or `services.AddUpstoxSdk(cfg => { ... })`.
- `IOptionService` supports resolving strikes by premium (`PlaceOrderByOptionPriceAsync`, `GetOrderByOptionPriceAsync`) or by strike type (ATM/OTM1-5/ITM1-5: `PlaceOrderByStrikeV3Async`, `GetOrderByStrikeAsync`). `PriceSearchMode` enum controls option-price resolution: `Nearest` (default), `GreaterThan`, `LessThan`.
- `Get*` variants (e.g. `GetOrderByOptionPriceAsync`) resolve the strike and return the `PlaceOrderRequest` without placing it — use to inspect before committing.
- `IMarginService.GetRequiredMarginAsync(items)` — calls `POST /v2/charges/margin`; returns `RequiredMargin` and `FinalMargin`. Exposed via `UpstoxClient.GetRequiredMarginAsync`.
- `IPositionService.ConvertPositionAsync` — calls `PUT /v2/portfolio/convert-position`. Exposed at `POST /api/upstox/positions/{instrumentToken}/convert`.

### Risk Engine (`KAITerminal.RiskEngine`)

A library; consumed by Worker and Console via `services.AddRiskEngine<TTokenSource>(configuration)`.

**Background worker:** `StreamingRiskWorker` — WebSocket-driven; reacts to Upstox portfolio + market-data events per user in parallel. LTP-triggered evaluations are rate-limited via `LtpEvalMinIntervalMs` (default 15 s). Portfolio events (order fills, position changes) always evaluate immediately bypassing the rate limit.

**`RiskEvaluator` checks (in order)** — thresholds read from `UserConfig` (per-user, from DB):
1. MTM stop loss (`MtmSl`) → exit all
2. MTM profit target (`MtmTarget`) → exit all
3. Trailing SL (`TrailingEnabled: true`):
   - Activates when MTM ≥ `TrailingActivateAt`
   - Stop locks at `LockProfitAt` — a fixed floor, not relative to MTM at activation
   - Raised by `IncreaseTrailingBy` every time MTM gains `WhenProfitIncreasesBy` from last step
   - Fires (exit all) when MTM falls to or below the trailing stop

**State:** `InMemoryRiskRepository` (`ConcurrentDictionary<string, UserRiskState>`) holds trailing SL state and squared-off flag per `userId`. State resets on host restart.

**`IUserTokenSource`** (async) decouples user/token supply from the engine:
- `DbUserTokenSource` (Worker) — queries `UserRiskConfigs WHERE Enabled=true` joined with `BrokerCredentials` on every tick; auto-picks up DB changes without restart
- `SingleUserTokenSource` (Console) — reads `Upstox:AccessToken` from config

### API Data Storage

PostgreSQL via Neon — connection string set in `ConnectionStrings:DefaultConnection`. `AppDbContext` (in `KAITerminal.Infrastructure`) manages these tables (created automatically via `EnsureCreatedAsync()` on first startup — new tables require manual `ALTER TABLE` / `CREATE TABLE` on Neon):

| Table | Purpose |
|---|---|
| `BrokerCredentials` | Per-user broker API key, secret, and access token |
| `UserTradingSettings` | Per-user trading preferences (underlying, expiry, etc.) |
| `AppUsers` | User registry — `Email`, `Name`, `IsActive`, `IsAdmin`, `CreatedAt` |
| `UserRiskConfigs` | Per-user PP/risk config — `Enabled`, `MtmTarget`, `MtmSl`, trailing SL fields |

Services: `BrokerCredentialService`, `UserService` (`IUserService`), `RiskConfigService` (`IRiskConfigService`) — all scoped, registered via `AddDatabase()`.

### Frontend (`frontend/src`)

- Routing: React Router v7; routes in `App.tsx`. Non-auth pages wrapped in `ProtectedRoute`. `/auth/inactive` is public — shown to users pending activation.
- State: Zustand stores in `stores/` persisted to `localStorage` (`kai-terminal-auth`, `kai-terminal-brokers`). Logout clears all stores and calls `localStorage.clear()`. **PP store is not persisted** — loaded from `GET /api/risk-config` on mount via `useRiskConfig` hook.
- All backend HTTP calls go through `services/broker-api.ts`; reads `VITE_API_URL` (default `https://localhost:5001`). Trading-specific calls (positions with exchange filter) go through `services/trading-api.ts`.
- Live positions use `@microsoft/signalr` — `PositionsPanel` connects to `WSS /hubs/positions?upstoxToken=...` on mount, handles `ReceivePositions` (full refresh), `ReceiveLtpBatch` (in-place LTP + P&L update), and `ReceiveOrderUpdate` (toast notification + Orders panel refresh). Shows a live `Wifi`/`WifiOff` indicator.
- UI: shadcn/ui components; add new ones with `npx shadcn add <component>`.
- **Always use shadcn components over native HTML equivalents** — e.g. `Checkbox` instead of `<input type="checkbox">`. shadcn `Checkbox` supports `checked="indeterminate"` natively (no `ref` hack). `onCheckedChange` receives `CheckedState` (`boolean | "indeterminate"`).
- **Auth / session management:**
  - `lib/logout.ts` — `performLogout()` is the single source of truth for logout. Clears all Zustand stores, `localStorage`, and redirects to `/login`. Use this everywhere instead of duplicating store-clearing logic.
  - `ProtectedRoute` checks JWT expiry on every render — if expired, calls `performLogout()`. Also checks `isActive` claim — if false, redirects to `/auth/inactive`.
  - `api-client.ts` request interceptor calls `isTokenExpired` before attaching the `Authorization` header — aborts the request if expired.
  - `api-client.ts` response interceptor catches `401` responses mid-session and calls `performLogout()` automatically.
  - `auth-store.ts` stores `isActive` and `isAdmin` decoded from JWT claims.
- **Error boundary** — `components/error-boundary.tsx` wraps the entire app in `main.tsx`. Catches unexpected React crashes and renders a recovery screen with reload + recover options.
- **Env validation** — `lib/constants.ts` checks `VITE_API_URL` on module load and logs a clear error to the console if missing.
- **Supported indices** — NIFTY, SENSEX, BANKNIFTY, FINNIFTY, BANKEX (in that order). Enforced in `UNDERLYING_KEYS` (`lib/shift-config.ts`) and `UserTradingSettings`. Upstox instrument keys: `NSE_INDEX|Nifty 50`, `BSE_INDEX|SENSEX`, `NSE_INDEX|Nifty Bank`, `NSE_INDEX|Nifty Fin Service`, `BSE_INDEX|BANKEX` — note BANKEX uses `BSE_INDEX|BANKEX` (all-caps, no "BSE-" prefix).
- **Index ticker** — shows any of the 5 indices; defaults to NIFTY + SENSEX. A `SlidersHorizontal` popover lets the user toggle which indices are shown; selection is persisted to `localStorage`. Each card shows LTP + net change on the left and O/H/L as a vertical list on the right separated by a subtle border.
- **Dashboard page** (`/dashboard`) — live at-a-glance view: Row 1: 4 stat cards (MTM with flash, Unrealised, Realised, Open count). Row 2: 5 index cards with O/H/L mini-columns. Row 3: open positions mini-table + Day Extremes card + Profit Protection status card. All data from `usePositionsFeed`, `useIndicesFeed`, and `localStorage` — no new backend calls.
- **Quick Trade** — amber (`bg-amber-500`) button in the header (visible when broker authenticated). Has two tabs:
  - **By Price** — premium input, Buy/Sell toggle, CE/PE/Both action buttons with context-aware icons (`TrendingUp`/`TrendingDown`/`ArrowUpDown`). Expiry from `GET /api/upstox/options/contracts/current-year`, formatted as `TUE, 17th MAR 2026`.
  - **By Chain** — Straddle/Strangle strategy toggle. Fetches live chain via `GET /api/upstox/options/chain`, auto-scrolls to ATM row. Straddle: CE+PE at same strike. Strangle: symmetric OTM pairs widening from ATM. Shows live required margin (debounced 600ms) via `POST /api/upstox/margin`. Dialog widens to `max-w-2xl` on chain tab.
- **Position row actions** — three-dot menu on each row opens contextual dialogs: Exit Position (qty + Limit/Market toggle + limit price), Sell/Buy More (same layout, adapts to direction), Convert Position (Intraday↔Delivery, qty input). All dialogs show a symbol chip with contract name, LTP, expiry, qty.
- **Keyboard shortcuts** — `Q` Quick Trade, `R` Refresh, `E` Exit All (with confirm), `?` opens help popover in stats bar. Help popover implemented in `components/terminal/keyboard-shortcuts-help.tsx`.
- **Option contracts** — `GET /api/upstox/options/contracts/current-year` returns only contracts expiring in the current calendar year, sorted by expiry. Use this for expiry dropdowns instead of the full contracts endpoint.
- **AI Signals page** (`/ai-signals`) — `GET /api/ai/market-sentiment` assembles a market snapshot (index quotes, NIFTY+BANKNIFTY option chains, last 30 × 1-min NIFTY candles) and fans out to GPT-4o, Grok, Gemini, Claude in parallel (30s timeout each). Each model returns direction / confidence / reasons / support / resistance / watch_for as JSON. Frontend polls every 15 minutes with a countdown timer; manual refresh button. Page shows a `MarketContextBar` and 4 `SentimentCard` components. API keys configured via `AiSentiment` config section; add with `dotnet user-secrets`. Requires `X-Upstox-Access-Token` header (same as other Upstox endpoints, but endpoint is at `/api/ai/` so the token context is set manually inside the handler).
- **Profit Protection** — config is DB-backed. `useRiskConfig` hook loads from `GET /api/risk-config` on mount and saves via `PUT /api/risk-config`. The PP toggle uses an optimistic update (flips instantly, API call in background, reverts on failure). `useProfitProtection` hook is **display-only** — computes `currentSl` for the stats bar from live positions feed; exit orders are fired by the backend Worker, not the frontend. PP store (`profit-protection-store.ts`) is not persisted to localStorage.
- **Profit Protection env defaults** — PP store initial defaults can be overridden via `frontend/.env` variables: `VITE_PP_MTM_TARGET`, `VITE_PP_MTM_SL`, `VITE_PP_TRAILING_ENABLED`, `VITE_PP_TRAILING_ACTIVATE_AT`, `VITE_PP_LOCK_PROFIT_AT`, `VITE_PP_INCREASE_BY`, `VITE_PP_TRAIL_BY`. These are only used before the API config loads.

---

## Configuration Reference

| File | Purpose |
|---|---|
| `backend/KAITerminal.Api/appsettings.json` | `Jwt:*`, `GoogleAuth:*`, `Frontend:Url`, `Upstox:ApiBaseUrl/HftBaseUrl`, `ConnectionStrings:DefaultConnection`, `AiSentiment:*`, `ApplicationInsights:ConnectionString` |
| `backend/KAITerminal.Worker/appsettings.json` | `Upstox:*`, `RiskEngine:*`, `ConnectionStrings:DefaultConnection`, `ApplicationInsights:ConnectionString` |
| `backend/KAITerminal.Console/appsettings.json` | `Upstox:AccessToken`, `RiskEngine:*`, `ApplicationInsights:ConnectionString` |
| `frontend/.env` | `VITE_API_URL` (optional), `VITE_PP_MTM_TARGET`, `VITE_PP_MTM_SL`, and other PP defaults |

Store real tokens with `dotnet user-secrets` instead of committing them to `appsettings.json`:

```bash
cd backend/KAITerminal.Api
dotnet user-secrets set "Jwt:Key" "<secret>"
dotnet user-secrets set "GoogleAuth:ClientId" "<id>"
dotnet user-secrets set "GoogleAuth:ClientSecret" "<secret>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"

cd ../KAITerminal.Console
dotnet user-secrets set "Upstox:AccessToken" "<daily_token>"

cd ../KAITerminal.Worker
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"

# AI Signals (KAITerminal.Api)
cd ../KAITerminal.Api
dotnet user-secrets set "AiSentiment:OpenAiApiKey"  "sk-..."
dotnet user-secrets set "AiSentiment:GrokApiKey"    "xai-..."
dotnet user-secrets set "AiSentiment:GeminiApiKey"  "AIza..."
dotnet user-secrets set "AiSentiment:ClaudeApiKey"  "sk-ant-..."

# Azure Application Insights — set in each project that sends telemetry
cd ../KAITerminal.Api
dotnet user-secrets set "ApplicationInsights:ConnectionString" "InstrumentationKey=...;IngestionEndpoint=..."

cd ../KAITerminal.Worker
dotnet user-secrets set "ApplicationInsights:ConnectionString" "InstrumentationKey=...;IngestionEndpoint=..."

cd ../KAITerminal.Console
dotnet user-secrets set "ApplicationInsights:ConnectionString" "InstrumentationKey=...;IngestionEndpoint=..."
```

App Insights is **optional** — if `ConnectionString` is empty the SDK is a no-op and all logs go to console only. See `docs/logging.md` for the full log level configuration and troubleshooting guide.

---

## User Trading Profile

This terminal is built **primarily for options sellers** (short options traders). All UI decisions must reflect a seller's perspective:

- **PE = green** — seller profits if market stays above strike (bullish for seller)
- **CE = red** — seller profits if market stays below strike (bearish for seller)
- Colour coding, icons, labels, and feature suggestions should always be from the **seller's point of view**, not the buyer's

---

## React Component Philosophy

- **Small, focused components** — every component should do one thing. If a component is growing large, extract logical pieces into their own files.
- **One component per file** — each file exports a single primary component. Helper sub-components used only within that file are the only exception.
- **Readable over clever** — code should be immediately understandable. A new developer (or Claude in a future session) should grasp what a component does in under 10 seconds.
- **Co-locate by feature** — related components live together (e.g. `panels/positions-panel/position-row.tsx`, `terminal/session-timer.tsx`). Don't dump everything in one folder.
- **Custom hooks for logic** — extract `useEffect`-heavy or reusable logic into a `use*.ts` hook file alongside the component.
- **No inline logic in JSX** — complex expressions belong in a variable or helper function above the return statement, not inside JSX.

---

## UI Design Standard

All frontend UI must be **modern, classy, and beautiful**. This is a non-negotiable requirement for every component, panel, and page. When building or modifying UI:

- Prefer polished shadcn/ui components over native HTML elements
- Use refined spacing, subtle borders (`border-border/40`), and layered backgrounds (`bg-muted/20`, `bg-muted/30`)
- Favour elegant typography: clear hierarchy, muted secondary text, tabular numerals for data
- Use purposeful colour — green/red for P&L, muted for inactive/secondary, primary for interactive focus
- Avoid visual clutter; every element should earn its place
- Animations and transitions should feel smooth and intentional, not jarring
- The overall aesthetic should feel like a premium financial terminal
- **Keep the default shadcn rounded corners** — do not switch to sharp/square corners
