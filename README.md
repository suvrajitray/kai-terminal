# KAI Terminal

A full-stack options trading terminal built for **options sellers** in Indian equity derivatives (NFO/BFO). Live positions, real-time P&L, automated profit protection, AI market signals, and instant risk event alerts pushed to the browser the moment they fire.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | .NET 10, ASP.NET Core minimal API, SignalR, EF Core |
| Database | PostgreSQL (Neon) |
| Auth | Google OAuth 2.0, JWT (HS256) |
| Brokers | Upstox (full), Zerodha (REST; streaming stub) |
| Frontend | React 19, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui |
| State | Zustand (persisted to localStorage) |

---

## Features

- **Live positions** — WebSocket-driven LTP + P&L updates via SignalR; live Wifi/WifiOff indicator
- **Profit Protection** — backend Worker monitors MTM per user and fires exits on hard SL, target, or trailing SL
- **Risk event alerts** — every risk trigger (SL hit, target hit, TSL activated/raised/fired, square-off) delivered as a browser toast in real time via a dedicated SignalR hub
- **Quick Trade** — place options orders by premium or by chain (straddle/strangle), with live margin preview
- **AI Signals** — GPT-4o, Grok, Gemini, and Claude analyse the market in parallel every 15 minutes
- **Multi-broker** — unified position/order DTOs regardless of broker; add a new broker by implementing two interfaces
- **Option contracts** — live merged contract list from all connected brokers; cached daily until 8:15 AM IST
- **Index ticker** — live NIFTY, SENSEX, BANKNIFTY, FINNIFTY, BANKEX with O/H/L

---

## Repository Layout

```
kai-terminal/
├── backend/
│   ├── KAITerminal.Api/           REST API + SignalR hubs
│   │   ├── Endpoints/             Minimal API route groups
│   │   ├── Hubs/                  PositionsHub, IndexHub, RiskHub
│   │   └── Notifications/         SignalRRiskEventNotifier
│   ├── KAITerminal.Worker/        Multi-user risk engine host
│   │   └── Notifications/         HttpRiskEventNotifier
│   ├── KAITerminal.Console/       Single-user risk engine host
│   ├── KAITerminal.RiskEngine/    Risk logic library
│   │   ├── Services/              RiskEvaluator
│   │   ├── Workers/               StreamingRiskWorker
│   │   └── Notifications/         NullRiskEventNotifier (no-op default)
│   ├── KAITerminal.Contracts/     Shared domain types — leaf node, no deps
│   │   ├── Domain/                Position, BrokerFunds, BrokerOrderRequest
│   │   ├── Streaming/             IMarketDataStreamer, IPortfolioStreamer
│   │   ├── Options/               IndexContracts, ContractEntry
│   │   ├── Broker/                IOptionContractProvider
│   │   └── Notifications/         IRiskEventNotifier, RiskNotification
│   ├── KAITerminal.Broker/        IBrokerClient, IBrokerClientFactory
│   ├── KAITerminal.Upstox/        Upstox SDK (full)
│   ├── KAITerminal.Zerodha/       Zerodha SDK (streaming stubbed)
│   ├── KAITerminal.Infrastructure/ EF Core + PostgreSQL
│   └── KAITerminal.Auth/          OAuth + JWT helpers
└── frontend/
    └── src/
        ├── components/            UI components (shadcn/ui based)
        ├── hooks/                 useRiskFeed, useIndicesFeed, useRiskConfig, …
        ├── pages/                 Route-level page components
        ├── stores/                Zustand stores (auth, broker, profit-protection)
        ├── services/              API client helpers
        ├── types/                 TypeScript interfaces matching backend DTOs
        └── lib/                   Utilities, constants, logout
```

---

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- PostgreSQL database ([Neon](https://neon.tech) free tier works)
- Upstox developer account with an app (API key + secret)
- Google Cloud OAuth 2.0 app (Client ID + secret)
- *(optional)* Zerodha Kite Connect app
- *(optional)* AI API keys for the AI Signals feature

---

## Getting Started

### 1. Clone

```bash
git clone <repo-url>
cd kai-terminal
```

### 2. Backend secrets

Use `dotnet user-secrets` — never commit real credentials.

```bash
# API
cd backend/KAITerminal.Api
dotnet user-secrets set "Jwt:Key"                    "<256-bit random string>"
dotnet user-secrets set "Jwt:Issuer"                 "KAITerminal"
dotnet user-secrets set "Jwt:Audience"               "KAITerminal"
dotnet user-secrets set "Jwt:ExpiryMinutes"          "480"
dotnet user-secrets set "GoogleAuth:ClientId"        "<google-client-id>"
dotnet user-secrets set "GoogleAuth:ClientSecret"    "<google-client-secret>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" \
  "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"

# Risk event notifications — same UUID in both Api and Worker
dotnet user-secrets set "Api:InternalKey"  "<uuid>"

# AI Signals (optional — omit to disable)
dotnet user-secrets set "AiSentiment:OpenAiApiKey"   "sk-..."
dotnet user-secrets set "AiSentiment:GrokApiKey"     "xai-..."
dotnet user-secrets set "AiSentiment:GeminiApiKey"   "AIza..."
dotnet user-secrets set "AiSentiment:ClaudeApiKey"   "sk-ant-..."

# Application Insights (optional)
dotnet user-secrets set "ApplicationInsights:ConnectionString" "InstrumentationKey=...;IngestionEndpoint=..."
```

```bash
# Worker
cd ../KAITerminal.Worker
dotnet user-secrets set "ConnectionStrings:DefaultConnection" \
  "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"
dotnet user-secrets set "Api:InternalKey"  "<same-uuid-as-above>"
dotnet user-secrets set "Api:BaseUrl"      "https://localhost:5001"
dotnet user-secrets set "ApplicationInsights:ConnectionString" "..."
```

```bash
# Console (single-user alternative to Worker — optional)
cd ../KAITerminal.Console
dotnet user-secrets set "Upstox:AccessToken" "<your-daily-upstox-token>"
```

### 3. Google OAuth

In your Google Cloud Console add this redirect URI:

```
https://localhost:5001/auth/google/callback
```

### 4. Frontend

```bash
cd frontend
npm install
```

Optionally create `frontend/.env.local` (gitignored) to override the default API URL:

```env
VITE_API_URL=https://localhost:5001
```

---

## Running

Open three terminals:

```bash
# Terminal 1 — API (HTTPS :5001)
cd backend && dotnet run --project KAITerminal.Api

# Terminal 2 — Risk engine Worker (profit protection for all enabled users)
cd backend && dotnet run --project KAITerminal.Worker

# Terminal 3 — Frontend (http://localhost:3000)
cd frontend && npm run dev
```

Open `http://localhost:3000` and sign in with Google.

> **First login:** Your account is created with `IsActive=false`. The email `suvrajit.ray@gmail.com` is auto-activated as admin. All other users must be activated manually in the `AppUsers` table in the database.

---

## Connecting a broker

### Upstox

1. **Settings → Brokers → Upstox** → enter API key + secret → **Save**
2. Click **Authenticate** → Upstox OAuth page opens → approve access
3. You are redirected back to `/redirect/upstox` which exchanges the code, saves the token to DB, and navigates to `/terminal`

> Upstox access tokens expire daily. Re-authenticate each morning before trading.

### Zerodha

1. **Settings → Brokers → Zerodha** → enter API key + secret → **Save**
2. `GET /api/zerodha/auth-url?apiKey=<key>` returns the Kite Connect login URL
3. After login you receive a `request_token` — exchange it: `POST /api/zerodha/access-token`

> Zerodha real-time streaming is not yet implemented. Position updates require a manual refresh. Risk monitoring for Zerodha users will not fire exit orders until streaming is added.

---

## Profit Protection

The Worker process monitors every enabled user's MTM and fires exit orders automatically. Configure per user in **Settings → Profit Protection** (saved to DB via `PUT /api/risk-config`).

| Field | Description |
|---|---|
| MTM Stop Loss | Exit all if MTM ≤ this value (e.g. `−5000`) |
| MTM Target | Exit all if MTM ≥ this value (e.g. `25000`) |
| Trailing SL enabled | Turn on the trailing stop loss |
| Activate at | TSL activates when MTM first reaches this level |
| Lock profit at | Floor is set to this value when TSL first activates |
| When profit increases by | Raise floor every time MTM gains this much from last step |
| Increase trailing by | Raise the floor by this amount per step |

Checks run in order: **Hard SL → Target → Trailing SL**. Once a user is squared off, no further evaluations run until the Worker restarts.

### Risk event alerts

Every time a risk event fires, a toast notification appears in the browser immediately:

| Event | Toast colour | When |
|---|---|---|
| Session started | Blue | Streams go live and user has open positions |
| TSL activated | Blue | MTM crosses the TSL activation threshold |
| TSL raised | Blue | TSL floor moves up |
| Target hit | Green | MTM reaches the profit target |
| Square-off complete | Green | All positions successfully exited |
| Hard SL hit | Red | MTM hits the hard stop loss |
| TSL hit | Red | MTM falls to or below the trailing floor |
| Square-off failed | Red | Exit order failed — manual action required |

**How it works:**

```
Worker: StreamingRiskWorker
  → RiskEvaluator fires event
      → HttpRiskEventNotifier
          POST /api/internal/risk-event  [X-Internal-Key header]
              → Api: SignalRRiskEventNotifier
                  → RiskHub (JWT-authenticated SignalR hub)
                      → browser useRiskFeed hook → sonner toast
```

The `Api:InternalKey` user-secret must be set to the same value in both the Api and Worker processes. If the key is missing from the Api, the endpoint returns 503 and no alerts are delivered.

---

## Risk engine log messages

All risk engine logs follow the format `{UserId} ({Broker})` and format monetary values as `₹+#,##0` / `₹-#,##0`.

| Event | Level | Sample log message |
|---|---|---|
| Worker startup | Info | `RiskWorker started — trading window 09:15–15:30 Asia/Kolkata, LTP eval every 15000ms` |
| Session starting | Info | `Starting session — user@email (upstox)` |
| Streams live | Info | `Streams live — user@email (upstox)  watching 5 open instrument(s)` |
| Heartbeat (TSL off) | Info | `user@email (upstox)  PnL ₹+11,353  \|  SL ₹-5,000  \|  Target ₹+25,000  \|  TSL off — activates at ₹+15,000` |
| Heartbeat (TSL on) | Info | `user@email (upstox)  PnL ₹+11,353  \|  Target ₹+25,000  \|  TSL ₹+3,025` |
| Market open | Info | `Market open — risk engine active (09:15–15:30 Asia/Kolkata)` |
| Market closed | Info | `Market closed — risk engine paused until 09:15 Asia/Kolkata` |
| TSL activated | Info | `TSL ACTIVATED — user@email (upstox)  floor locked at ₹+3,025` |
| TSL raised | Info | `TSL RAISED — user@email (upstox)  floor → ₹+5,025` |
| Target hit | Info | `TARGET HIT — user@email (upstox)  PnL ₹+25,000  ≥  Target ₹+25,000 — exiting all` |
| Hard SL hit | Warn | `HARD SL HIT — user@email (upstox)  PnL ₹-5,000  ≤  SL ₹-5,000 — exiting all` |
| TSL hit | Warn | `TSL HIT — user@email (upstox)  PnL ₹+3,000  ≤  floor ₹+3,025 — exiting all` |
| Square-off complete | Warn | `Square-off complete — user@email (upstox) — all positions exited` |
| Square-off failed | Error | `Square-off FAILED — user@email (upstox) — marked as squared-off; manual verification required` |
| Session crash + restart | Warn | `Restarting session — user@email (upstox) in 30s` |

---

## AI Signals

The `/ai-signals` page polls `GET /api/ai/market-sentiment` every 15 minutes (manual refresh also available). The endpoint:

1. Fetches live index quotes, NIFTY + BANKNIFTY option chains, and the last 30 × 1-min NIFTY candles
2. Fans out to GPT-4o, Grok, Gemini, and Claude in parallel (30s timeout each)
3. Each model returns: direction, confidence, reasons, support/resistance levels, what to watch for

Requires `X-Upstox-Access-Token` header and AI API keys set via `dotnet user-secrets` in `KAITerminal.Api`.

---

## Architecture

```
KAITerminal.Contracts   ← leaf node — all shared domain + notification types
        ↑
KAITerminal.Broker      ← IBrokerClient, IBrokerClientFactory
        ↑
KAITerminal.Upstox      ← Upstox SDK (full implementation)
KAITerminal.Zerodha     ← Zerodha SDK (streaming stubbed)
        ↑
KAITerminal.RiskEngine  ← risk logic; zero broker deps
KAITerminal.Api         ← REST API + SignalR hubs (PositionsHub, IndexHub, RiskHub)
KAITerminal.Worker      ── RiskEngine + Infrastructure (multi-user host)
KAITerminal.Console     ── RiskEngine (single-user host)
```

**Adding a new broker** (e.g. Dhan): create `KAITerminal.Dhan`, implement `IBrokerClient` + `IOptionContractProvider`, register in `BrokerExtensions`. Zero changes to RiskEngine, Contracts, or Infrastructure.

---

## API reference

Full interactive docs at `https://localhost:5001/scalar/v1` in development (DeepSpace theme). OpenAPI spec at `/openapi/v1.json`.

Key endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google` | Start Google OAuth flow |
| `GET` | `/auth/google/callback` | OAuth callback; issues JWT |
| `GET` | `/api/upstox/positions` | Open positions (`?exchange=NFO,BFO` optional) |
| `GET` | `/api/upstox/orders` | Today's orders |
| `GET` | `/api/upstox/mtm` | Portfolio MTM P&L |
| `GET` | `/api/zerodha/positions` | Zerodha open positions |
| `GET` | `/api/masterdata/contracts` | Merged option contracts (all connected brokers) |
| `GET` | `/api/risk-config` | Load PP config for current user |
| `PUT` | `/api/risk-config` | Save PP config for current user |
| `GET` | `/api/ai/market-sentiment` | AI market signals (all 4 models) |
| `POST` | `/api/internal/risk-event` | Internal — Worker → Api risk event relay |
| `WS` | `/hubs/positions` | Live positions + LTP (Upstox-only; `?upstoxToken=`) |
| `WS` | `/hubs/indices` | Live index quotes (`?upstoxToken=`) |
| `WS` | `/hubs/risk` | Risk event alerts (JWT Bearer via `?access_token=`) |

---

## Database

PostgreSQL via [Neon](https://neon.tech). Tables are created automatically on first startup via `EnsureCreatedAsync()` — no migrations needed. New tables/columns require manual SQL on Neon.

| Table | Purpose |
|---|---|
| `AppUsers` | User registry — `Email`, `IsActive`, `IsAdmin` |
| `BrokerCredentials` | Per-user broker API key + secret + access token |
| `UserTradingSettings` | Per-user trading preferences (underlying, expiry, etc.) |
| `UserRiskConfigs` | Per-user profit protection config + `Enabled` flag |

---

## Configuration reference

| File | Key settings |
|---|---|
| `backend/KAITerminal.Api/appsettings.json` | `Jwt:*`, `GoogleAuth:*`, `Frontend:Url`, `Upstox:ApiBaseUrl/HftBaseUrl`, `Api:BaseUrl/InternalKey`, `AiSentiment:*`, `ApplicationInsights:ConnectionString` |
| `backend/KAITerminal.Worker/appsettings.json` | `Upstox:*`, `RiskEngine:*`, `Api:BaseUrl`, `Api:InternalKey`, `ConnectionStrings:DefaultConnection` |
| `backend/KAITerminal.Console/appsettings.json` | `Upstox:AccessToken`, `RiskEngine:*` |
| `frontend/.env` | `VITE_API_URL`, `VITE_PP_MTM_TARGET`, `VITE_PP_MTM_SL`, other PP defaults |

`Frontend:Url` in the API config must match the frontend origin for CORS and OAuth redirects to work (default `http://localhost:3000`).

---

## Development commands

```bash
# Backend
cd backend
dotnet build                              # Build entire solution
dotnet watch --project KAITerminal.Api    # Hot-reload API

# Frontend
cd frontend
npm run dev      # Dev server :3000
npm run build    # TypeScript check + production build
npm run lint     # ESLint
```
