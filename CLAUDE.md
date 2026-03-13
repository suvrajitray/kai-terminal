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
| `KAITerminal.Worker` | `Sdk.Worker` | Multi-user risk engine host — reads `RiskEngine:Users[]` from config |
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
                     ──► KAITerminal.Auth

KAITerminal.Worker   ──► KAITerminal.RiskEngine ──► KAITerminal.Upstox
KAITerminal.Console  ──► KAITerminal.RiskEngine
```

---

## Architecture

### API (`KAITerminal.Api`)

- `Program.cs` wires services via extension methods in `Extensions/` and maps endpoint groups in `Endpoints/`.
- Minimal-API style — no controllers.
- Auth flow: `GET /auth/google` → Google OAuth → `GET /auth/google/callback` issues a JWT → frontend redirected to `/auth/callback?token=<jwt>`. All subsequent API calls use `Authorization: Bearer <token>`.
- `BrokerExtensions.AddBrokerServices()` registers `AddUpstoxSdk()`. The API uses `UpstoxTokenContext.Use(token)` per-request to inject the user's Upstox access token into broker calls (passed by frontend as `X-Upstox-AccessToken` header).
- Credentials (`Jwt:Key`, `GoogleAuth:ClientId/Secret`, `ConnectionStrings:DefaultConnection`) and `Frontend:Url` must be set in `appsettings.json` or `dotnet user-secrets` before the API starts.
- `Frontend:Url` (default `http://localhost:3000`) controls CORS allowed origins and the OAuth redirect.
- **Live positions** — `PositionsHub` (`Hubs/PositionsHub.cs`) is a SignalR hub mounted at `/hubs/positions`. On connect it fetches positions, starts per-connection `IPortfolioStreamer` + `IMarketDataStreamer`, and pushes `ReceivePositions` / `ReceiveLtpBatch` / `ReceiveOrderUpdate` messages. `PositionStreamManager` (singleton) tracks streamer pairs by connection ID and disposes them on disconnect.
- **Portfolio stream** — `ConnectAsync` must be called with explicit `UpdateType` values (e.g. `[UpdateType.Order, UpdateType.Position]`); Upstox delivers no events if `update_types` query params are omitted. The Upstox portfolio stream JSON frame uses `update_type` (not `type`) and all fields are flat at the root — there is no nested `data` object.
- **Order update notifications** — `ReceiveOrderUpdate` is pushed to the frontend on every `update_type=order` event. Frontend shows `toast.error` for `rejected` status and `toast.success` for `complete`; the Orders panel auto-refreshes on every order event.
- **Exchange filter** — `GET /api/upstox/positions?exchange=NFO,BFO` and `GET /api/upstox/mtm?exchange=NFO,BFO` accept a comma-separated exchange list; the `PositionsHub` also accepts `?exchange=` on the WebSocket URL. Filtering is applied server-side; omit the param to receive all exchanges. See `docs/live-positions-websocket.md` for full protocol details.

### Upstox SDK (`KAITerminal.Upstox`)

Layered: `UpstoxClient` (facade) → `IPositionService` / `IOrderService` / `IOptionService` / `IAuthService` → `UpstoxHttpClient` (internal HTTP layer) → Upstox REST API.

- **`UpstoxTokenContext`** — `AsyncLocal<string?>` ambient token. Use `UpstoxTokenContext.Use(token)` to scope all API calls within the block to a specific user without passing the token explicitly.
- **Three named `HttpClient`s**: `"UpstoxApi"` (read, REST), `"UpstoxHft"` (order writes, lower latency), `"UpstoxAuth"` (OAuth exchange only, no Bearer header).
- Register with `services.AddUpstoxSdk(configuration)` or `services.AddUpstoxSdk(cfg => { ... })`.
- `IOptionService` supports resolving strikes by premium (`PlaceOrderByOptionPriceAsync`, `GetOrderByOptionPriceAsync`) or by strike type (ATM/OTM1-5/ITM1-5: `PlaceOrderByStrikeV3Async`, `GetOrderByStrikeAsync`). `PriceSearchMode` enum controls option-price resolution: `Nearest` (default), `GreaterThan`, `LessThan`.
- `Get*` variants (e.g. `GetOrderByOptionPriceAsync`) resolve the strike and return the `PlaceOrderRequest` without placing it — use to inspect before committing.

### Risk Engine (`KAITerminal.RiskEngine`)

A library; consumed by Worker and Console via `services.AddRiskEngine<TTokenSource>(configuration)`.

**Two background workers:**
- `PortfolioRiskWorker` (interval: `PortfolioCheckIntervalSeconds`, default 60 s) — calls `RiskEvaluator.EvaluateAsync` per user inside a `UpstoxTokenContext.Use(token)` scope.
- `StrikeRiskWorker` (interval: `StrikeCheckIntervalSeconds`, default 5 s) — calls `StrikeMonitor` per user, same token pattern. Disabled entirely when `EnableStrikeWorker: false`.

**`RiskEvaluator` checks (in order):**
1. Overall stop loss (`OverallStopLoss`, default −₹25k) → exit all
2. Profit target (`ProfitTarget`, default +₹25k) → exit all
3. Trailing SL (`EnableTrailingStopLoss: true`):
   - Activates when MTM ≥ `TrailingActivateAt` (default +₹5k)
   - Stop locks at `LockProfitAt` (default +₹2k) — a fixed floor, not relative to MTM at activation
   - Raised by `IncreaseTrailingBy` (default ₹500) every time MTM gains `WhenProfitIncreasesBy` (default ₹1k) from last step
   - Fires (exit all) when MTM falls to or below the trailing stop

**`StrikeMonitor`** checks per-position % loss: CE > `CeStopLossPercent` (20%), PE > `PeStopLossPercent` (30%). On trigger: exit position, then if `reentryCount < MaxReentries` (2) place a new OTM1 SELL via `PlaceOrderByStrikeV3Async`.

**State:** `InMemoryRiskRepository` (`ConcurrentDictionary<string, UserRiskState>`) holds trailing SL state, squared-off flag, and re-entry counts per `userId`. State resets on host restart.

**`IUserTokenSource`** decouples token supply from the engine:
- `ConfigTokenSource` (Worker) — reads `RiskEngine:Users[]` from config
- `SingleUserTokenSource` (Console) — reads `Upstox:AccessToken` from config

### API Data Storage

PostgreSQL via Neon — connection string set in `ConnectionStrings:DefaultConnection`. `AppDbContext` (in `KAITerminal.Infrastructure`) has a single `BrokerCredentials` table for per-user broker API key, secret, and access token. Table is created automatically on first startup via `EnsureCreatedAsync()`. `BrokerCredentialService` is scoped (per-request).

### Frontend (`frontend/src`)

- Routing: React Router v7; routes in `App.tsx`. Non-auth pages wrapped in `ProtectedRoute`.
- State: Zustand stores in `stores/` persisted to `localStorage` (`kai-terminal-auth`, `kai-terminal-brokers`, `kai-terminal-profit-protection`). Logout clears all stores and calls `localStorage.clear()`.
- All backend HTTP calls go through `services/broker-api.ts`; reads `VITE_API_URL` (default `https://localhost:5001`). Trading-specific calls (positions with exchange filter) go through `services/trading-api.ts`.
- Live positions use `@microsoft/signalr` — `PositionsPanel` connects to `WSS /hubs/positions?upstoxToken=...` on mount, handles `ReceivePositions` (full refresh), `ReceiveLtpBatch` (in-place LTP + P&L update), and `ReceiveOrderUpdate` (toast notification + Orders panel refresh). Shows a live `Wifi`/`WifiOff` indicator.
- UI: shadcn/ui components; add new ones with `npx shadcn add <component>`.
- **Always use shadcn components over native HTML equivalents** — e.g. `Checkbox` instead of `<input type="checkbox">`. shadcn `Checkbox` supports `checked="indeterminate"` natively (no `ref` hack). `onCheckedChange` receives `CheckedState` (`boolean | "indeterminate"`).

---

## Configuration Reference

| File | Purpose |
|---|---|
| `backend/KAITerminal.Api/appsettings.json` | `Jwt:*`, `GoogleAuth:*`, `Frontend:Url`, `Upstox:ApiBaseUrl/HftBaseUrl`, `ConnectionStrings:DefaultConnection` |
| `backend/KAITerminal.Worker/appsettings.json` | `Upstox:*`, `RiskEngine:*` with `Users[]` list |
| `backend/KAITerminal.Console/appsettings.json` | `Upstox:AccessToken`, `RiskEngine:*` (no `Users[]`) |
| `frontend/.env` | `VITE_API_URL` (optional) |

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
dotnet user-secrets set "RiskEngine:Users:0:AccessToken" "<daily_token>"
```

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
