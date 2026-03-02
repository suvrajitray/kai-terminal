# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository Layout

```
KAITerminal/
├── backend/          # .NET 10 solution (KAITerminal.slnx)
└── frontend/         # React 19 + Vite SPA
```

---

## Commands

### Backend (run from `backend/`)

```bash
dotnet build                          # Build entire solution
dotnet run --project KAITerminal.Api  # Run the REST API (HTTPS :5001)
dotnet run --project KAITerminal.RiskEngine  # Run the risk engine worker
dotnet watch --project KAITerminal.Api       # Hot-reload dev server
```

No test project exists yet; there is no `dotnet test` target.

### Frontend (run from `frontend/`)

```bash
npm install        # Install dependencies
npm run dev        # Dev server on :3000
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

The frontend `@` alias resolves to `frontend/src/`.

---

## Architecture

### Backend Projects

| Project | SDK | Role |
|---|---|---|
| `KAITerminal.Api` | `Microsoft.NET.Sdk.Web` | ASP.NET Core REST API; auth, credentials, Upstox proxy endpoints |
| `KAITerminal.RiskEngine` | `Microsoft.NET.Sdk.Worker` | Background worker service; autonomous risk management |
| `KAITerminal.Broker` | Library | Broker interfaces + Upstox implementation; shared by Api and RiskEngine |
| `KAITerminal.Types` | Library | Cross-project shared types (e.g. `AccessToken`) |
| `KAITerminal.Auth` | Library | OAuth/JWT service registration helpers |
| `KAITerminal.Infrastructure` | Library | EF Core DbContext, database initialisation |
| `KAITerminal.Util` | Library | Shared utilities |
| `KAITerminal.Console` | Console | Ad-hoc/scratch runner |

**Dependency graph (simplified):**
```
KAITerminal.Api ──► KAITerminal.Broker ──► KAITerminal.Types
KAITerminal.RiskEngine ──► KAITerminal.Broker
                      ──► KAITerminal.Types
```

### API (`KAITerminal.Api`)

- Entry point: `Program.cs` wires up services via extension methods in `Extensions/` and maps endpoint groups in `Endpoints/`.
- Endpoints use the minimal-API style (no controllers).
- Auth flow: Google OAuth → JWT issued at `/auth/google/callback` → frontend stores token → all API calls use `Authorization: Bearer <token>`.
- Secrets (`Jwt:Key`, `GoogleAuth:ClientId/Secret`, `Upstox:ApiKey/Secret`) must be populated in `appsettings.json` or `dotnet user-secrets` before the API will start correctly.
- SQLite DB file `kai-terminal.db` is created automatically alongside the running binary.

### Broker Layer (`KAITerminal.Broker`)

Three interfaces drive all broker interaction:

- `IPositionProvider` — fetch positions / MTM
- `IOrderExecutor` — place market orders to exit positions
- `ITokenGenerator` — OAuth2 code → access token exchange

Upstox implementations live in `Broker/Upstox/`. Adding a new broker means implementing these three interfaces and registering them in `BrokerExtensions.cs`.

`UpstoxHttpClient` is a thin wrapper that injects the Bearer token and base URL; use it for all Upstox HTTP calls.

### Risk Engine (`KAITerminal.RiskEngine`)

Two `BackgroundService` workers run continuously:

- `RiskBackgroundWorker` (60 s loop) → calls `RiskEvaluator` → checks overall MTM stop loss, profit target, and trailing stop loss; squares off all positions when triggered.
- `StrikeRiskWorker` (5 s loop) → calls `StrikeMonitor` → checks per-strike percentage loss (CE: 20%, PE: 30%); exits individual position and re-enters OTM (max 2 re-entries).

State is held in `InMemoryRiskRepository` (thread-safe via `ConcurrentDictionary` + `SemaphoreSlim`). Strategy activation state is in `InMemoryStrategyProvider`. `StartupSeeder` auto-activates strategies listed in `RiskEngine:Strategies` config on startup.

All risk thresholds are configured in `KAITerminal.RiskEngine/appsettings.json` under the `RiskEngine` section; no code changes are needed to tune them.

**The RiskEngine holds its own Upstox `AccessToken` directly in config** (`Upstox:AccessToken`), unlike the API which stores credentials per-user in SQLite.

### Frontend (`frontend/src`)

- Routing: React Router v7; routes defined in `App.tsx`. All non-auth pages are wrapped with `ProtectedRoute`.
- State: Zustand stores in `stores/` persisted to `localStorage` (`kai-terminal-auth`, `kai-terminal-brokers`).
- API calls: `services/broker-api.ts` centralises all backend HTTP calls; reads `VITE_API_URL` (defaults to `https://localhost:5001`).
- Pages map 1-to-1 to routes: `login-page`, `auth-callback-page`, `dashboard-page`, `connect-brokers-page`, `broker-redirect-page`.
- UI components are shadcn/ui; add new components with `npx shadcn add <component>`.

---

## Configuration Notes

- **API secrets** go in `backend/KAITerminal.Api/appsettings.json` (or user-secrets).
- **RiskEngine access token** goes in `backend/KAITerminal.RiskEngine/appsettings.json` under `Upstox:AccessToken`.
- **Frontend API URL** is set via the `VITE_API_URL` environment variable (defaults to `https://localhost:5001`).
- The frontend dev server runs on port **3000**, which must match `Frontend:Url` in the API config for CORS and OAuth redirects to work.
