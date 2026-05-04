# KAI Terminal

A full-stack options trading terminal built for **options sellers** in Indian equity derivatives (NFO/BFO). Live positions, real-time P&L, automated profit protection, AI market signals, and instant risk event alerts pushed to the browser the moment they fire.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Features](#features)
3. [Repository Layout](#repository-layout)
4. [Prerequisites & macOS Setup](#prerequisites--macos-setup)
5. [Getting Started](#getting-started)
6. [Running](#running)
7. [Connecting a Broker](#connecting-a-broker)
8. [Architecture](#architecture)
9. [Flows & In-Process State](#flows--in-process-state)
10. [API Reference](#api-reference)
11. [Live Positions WebSocket](#live-positions-websocket)
12. [Profit Protection](#profit-protection)
13. [Upstox SDK](#upstox-sdk)
14. [AI Signals](#ai-signals)
15. [Database](#database)
16. [Logging & Observability](#logging--observability)
17. [Production Deployment — Azure VM](#production-deployment--azure-vm)
18. [Configuration Reference](#configuration-reference)
19. [Development Commands](#development-commands)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | .NET 10, ASP.NET Core minimal API, SignalR, EF Core |
| Database | PostgreSQL (Neon) |
| Cache / Pub-Sub | Redis (StackExchange.Redis) |
| Auth | Google OAuth 2.0, JWT (HS256) |
| Brokers | Upstox (execution + market data), Zerodha (REST; streaming stub) |
| Frontend | React 19, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui |
| State | Zustand (persisted to localStorage) |

---

## Features

- **Live positions** — WebSocket-driven LTP + P&L updates via SignalR; live Wifi/WifiOff indicator
- **Profit Protection** — backend Worker monitors MTM per user and fires exits on hard SL, target, auto square-off, or trailing SL; `WatchedProducts` filter scopes evaluation to "All", "MIS only", or "NRML only" positions while terminal display remains complete
- **Auto square-off** — configurable time-based exit (IST, 24h); set in Settings → Trading Settings; evaluated as check #3 in the risk engine
- **Auto Shift** — risk engine automatically shifts sell positions further OTM when premium rises by a configured %; exits the position after a configurable max number of shifts; each original position leg has its own independent shift counter
- **Risk event alerts** — every risk trigger (SL hit, target hit, auto square-off, TSL activated/raised/fired, square-off, auto-shift) delivered as a browser toast in real time via a dedicated SignalR hub
- **Position shift** — manually shift any sell position up or down by a configurable strike gap; ↓ always means lower premium (safer/further OTM) for both CE and PE
- **Quick Trade** — place options orders by premium or by chain (straddle/strangle), for both Upstox and Zerodha, with live margin preview
- **Portfolio Greeks** — net delta (Δ) and theta (Θ/day) aggregated across all open positions; refreshed every 60s from option chain; seller-oriented coloring in the stats bar
- **P&L at expiry payoff chart** — visualises combined P&L at expiry per expiry group; each group gets a distinct colored curve; live spot price dot and breakeven annotations
- **Bulk exit by type** — "Exit CEs" / "Exit PEs" buttons in the positions toolbar for quick leg-type exits
- **Margin utilization gauge** — color bar beside available margin in stats bar; green ≤ 50%, amber ≤ 80%, red > 80%
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
│   │   ├── Services/              MasterDataService, …
│   │   └── Notifications/         SignalRRiskEventNotifier
│   ├── KAITerminal.Worker/        Multi-user risk engine host
│   │   └── Notifications/         HttpRiskEventNotifier
│   ├── KAITerminal.Console/       Single-user risk engine host
│   ├── KAITerminal.RiskEngine/    Risk logic library
│   │   ├── Services/              RiskEvaluator
│   │   ├── State/                 PositionCache, RedisRiskRepository
│   │   ├── Workers/               StreamingRiskWorker
│   │   └── Notifications/         NullRiskEventNotifier (no-op default)
│   ├── KAITerminal.Contracts/     Shared domain types — leaf node, no deps
│   │   ├── Domain/                Position, BrokerFunds, BrokerOrderRequest, BrokerOrder
│   │   ├── Streaming/             IMarketDataStreamer, ISharedMarketDataService, LtpUpdate, FeedMode
│   │   ├── Options/               IndexContracts, ContractEntry
│   │   ├── Broker/                IOptionContractProvider
│   │   └── Notifications/         IRiskEventNotifier, RiskNotification
│   ├── KAITerminal.Broker/        IBrokerClient, IBrokerClientFactory
│   ├── KAITerminal.Upstox/        Upstox SDK — execution only (auth, orders, positions, funds, margin)
│   ├── KAITerminal.Zerodha/       Zerodha SDK — execution only + margin; streaming stubbed
│   ├── KAITerminal.MarketData/    Market data — quotes, candles, option chain/contracts, WebSocket feed, Kite CSV, RedisLtpRelay
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
        └── lib/                   Utilities, constants, logger, logout
```

---

## Prerequisites & macOS Setup

### Required software

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- PostgreSQL 18 database ([Neon](https://neon.tech) free tier works, or local)
- Redis (`redis-server` locally, or any managed Redis)
- Upstox developer account with an app (API key + secret)
- Google Cloud OAuth 2.0 app (Client ID + secret)
- *(optional)* Zerodha Kite Connect app
- *(optional)* AI API keys for the AI Signals feature

### macOS — Homebrew install

Install [Homebrew](https://brew.sh) first if you don't have it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**.NET 10 SDK:**
```bash
brew install --cask dotnet-sdk
dotnet --version   # should be 10.x
```

**Node.js:**
```bash
brew install node
node --version   # 20+
```

**Redis:**
```bash
brew install redis
brew services start redis   # auto-start on login
redis-cli ping              # should return PONG
```

**PostgreSQL 18:**
```bash
brew install postgresql@18
brew services start postgresql@18

# Create the database and user
psql -d postgres -c "CREATE USER kaiuser WITH PASSWORD 'kaipassword';"
psql -d postgres -c "CREATE DATABASE kaiterminal OWNER kaiuser;"
psql -d kaiterminal -c "GRANT ALL ON SCHEMA public TO kaiuser;"
```

> [!NOTE]
> Making `kaiuser` the database **owner** avoids `permission denied for schema public` errors — a PostgreSQL 15+ behaviour change that affects `EnsureCreatedAsync`.

Local connection string (use this in user-secrets):
```
Host=localhost;Database=kaiterminal;Username=kaiuser;Password=kaipassword
```

**Docker** (needed for Seq):
```bash
brew install --cask docker
```
Open the Docker app from Applications to start the Docker daemon.

### GUI Tools

**TablePlus — PostgreSQL viewer**

```bash
brew install --cask tableplus
```

Connect to local PostgreSQL:
- Host: `127.0.0.1`, Port: `5432`, User: `kaiuser`, Password: `kaipassword`, Database: `kaiterminal`

TablePlus also connects to Neon — use the Neon connection string with SSL mode `Require`.

**Seq — Structured log viewer**

Seq 2025+ requires either a password or explicit no-auth flag. For local dev:

```bash
docker run -d --name seq \
  -p 5341:5341 -p 8080:80 \
  -e ACCEPT_EULA=Y \
  -e SEQ_FIRSTRUN_NOAUTHENTICATION=true \
  -v "$HOME/.seq-data:/data" \
  datalust/seq:latest
```

Seq UI at `http://localhost:8080`. Start/stop:
```bash
docker start seq
docker stop seq
```

Both the Api and Worker send structured logs to `http://localhost:5341` automatically. If Seq is not running they fall back to console-only without errors.

**RedisInsight — Redis viewer**

```bash
brew install --cask redisinsight
```

Connect to local Redis: Host `127.0.0.1`, Port `6379`, no password.

Useful views: **Browser** (inspect `appsetting:*` keys), **Pub/Sub** (subscribe to `ltp:feed` to watch live ticks), **CLI** (run `KEYS appsetting:*`, `FLUSHALL`).

---

## Getting Started

### 1. Clone

```bash
git clone git@github.com:suvrajitray/kai-terminal.git
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
  "Host=localhost;Database=kaiterminal;Username=kaiuser;Password=kaipassword"
dotnet user-secrets set "ConnectionStrings:Redis"    "localhost:6379"

# Risk event notifications — same UUID in both Api and Worker
dotnet user-secrets set "Api:InternalKey"  "<uuid>"

# AI Signals (optional — omit to disable)
dotnet user-secrets set "AiSentiment:OpenAiApiKey"   "sk-..."
dotnet user-secrets set "AiSentiment:GrokApiKey"     "xai-..."
dotnet user-secrets set "AiSentiment:GeminiApiKey"   "AIza..."
dotnet user-secrets set "AiSentiment:ClaudeApiKey"   "sk-ant-..."
```

```bash
# Worker
cd ../KAITerminal.Worker
dotnet user-secrets set "ConnectionStrings:DefaultConnection" \
  "Host=localhost;Database=kaiterminal;Username=kaiuser;Password=kaipassword"
dotnet user-secrets set "ConnectionStrings:Redis"    "localhost:6379"
dotnet user-secrets set "Api:InternalKey"  "<same-uuid-as-above>"
dotnet user-secrets set "Api:BaseUrl"      "https://localhost:5001"
```

```bash
# Console (single-user alternative to Worker — optional)
cd ../KAITerminal.Console
dotnet user-secrets set "Upstox:AccessToken" "<your-daily-upstox-token>"
```

> [!NOTE] Analytics Token
> The Worker uses one shared Upstox WebSocket for all market data. The analytics token is stored in the `AppSettings` DB table (key `UpstoxAnalyticsToken`) and set via **Settings → Admin → Analytics Token** in the UI or `PUT /api/admin/analytics-token`. No separate secret is needed — it persists in the database.

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

Open three terminal tabs. Start Seq first if you want structured log search:

```bash
docker start seq   # http://localhost:8080
```

```bash
# Terminal 1 — API (HTTPS :5001)
cd backend && dotnet run --project KAITerminal.Api
```

> [!TIP] First Run — Trust Dev Certificate
> ```bash
> dotnet dev-certs https --trust
> ```

```bash
# Terminal 2 — Risk engine Worker (profit protection + market data for all users)
cd backend && dotnet run --project KAITerminal.Worker
```

The Worker connects to Upstox via the analytics token configured in the Admin page. It logs a warning and remains idle until the token is set.

```bash
# Terminal 3 — Frontend (http://localhost:3000)
cd frontend && npm run dev
```

Open `http://localhost:3000` and sign in with Google.

> [!NOTE] First Login
> Your account is created with `IsActive=false`. The email `suvrajit.ray@gmail.com` is auto-activated as admin. All other users must be activated manually in the `AppUsers` table.

### First-Time Setup

1. **Log in** with `suvrajit.ray@gmail.com` — auto-activated as admin
2. **Connect a broker** — Settings → Brokers → Upstox → enter API key + secret → **Authenticate**
3. **Set the analytics token** — User menu → Admin → paste Upstox Analytics Token → Save
   - Obtain from [Upstox Developer Portal](https://upstox.com/developer/api-documentation/analytics-token) — valid for 1 year
4. **Restart the Worker** — reads the analytics token on startup; restart after saving it

---

## Connecting a Broker

### Upstox

1. **Settings → Brokers → Upstox** → enter API key + secret → **Save**
2. Click **Authenticate** → Upstox OAuth page opens → approve access
3. You are redirected back to `/redirect/upstox` which exchanges the code, saves the token to DB, and navigates to `/terminal`

> [!WARNING]
> Upstox access tokens expire daily. Re-authenticate each morning before 7:30 AM IST. The risk engine Worker automatically detects stale tokens (credentials not updated after 7:30 AM IST today) and excludes those users.

### Zerodha

1. **Settings → Brokers → Zerodha** → enter API key + secret → **Save**
2. `GET /api/zerodha/auth-url?apiKey=<key>` returns the Kite Connect login URL
3. After login you receive a `request_token` — exchange it: `POST /api/zerodha/access-token`

> [!NOTE]
> Zerodha portfolio/order streaming is stubbed — live LTP is sourced from the shared Upstox market-data feed via `exchange_token` mapping. Order status toasts are delivered via the Kite postback webhook (see below).

### Broker Webhook Setup (Order Notifications)

Webhooks push instant order-fill notifications to connected browser tabs without waiting for the 10-second position poll.

**Zerodha (Kite Connect)**

In your Kite app settings (developers.kite.trade), set the **Postback URL** to:

```
https://<your-host>/api/webhooks/zerodha/order?apiKey=<your_kite_api_key>
```

Each Kite app maps to exactly one KAI user via the `apiKey` query parameter. The API key in the URL must match the one stored in **Settings → Brokers → Zerodha** for that user.

**Upstox**

In your Upstox app settings, set the **Postback URL** to:

```
https://<your-host>/api/webhooks/upstox/order
```

Upstox sends a single postback URL for all users on the same app. KAI routes to the correct user via the `user_id` field in the postback payload, matched against the `BrokerUserId` stored in the DB. **Users must re-authenticate once after the DB migration** (`ALTER TABLE "BrokerCredentials" ADD COLUMN "BrokerUserId" VARCHAR;`) to populate this field.

Both endpoints verify the broker's cryptographic signature before processing — unauthenticated requests are rejected with `401`.

---

## Architecture

```
KAITerminal.Contracts   ← leaf node — all shared domain + notification types
        ↑
KAITerminal.Broker      ← IBrokerClient, IBrokerClientFactory
        ↑
KAITerminal.Upstox      ← execution only (auth, orders, positions, funds, margin)
KAITerminal.Zerodha     ← execution only + margin; streaming stubbed
KAITerminal.MarketData  ← market data only; zero Upstox/Zerodha SDK deps
        ↑
KAITerminal.RiskEngine  ← risk logic; zero broker/market-data deps
KAITerminal.Api         ← REST API + SignalR hubs (PositionsHub, IndexHub, RiskHub)
KAITerminal.Worker      ── RiskEngine + Upstox + Zerodha + MarketData + Infrastructure
KAITerminal.Console     ── RiskEngine (single-user host)
```

**Adding a new broker** (e.g. Dhan): create `KAITerminal.Dhan`, implement `IBrokerClient`, register in `BrokerExtensions`. Add an `IOptionContractProvider` implementation to `KAITerminal.MarketData` and register it in `AddMarketDataConsumer()`/`AddMarketDataProducer()`. Zero changes to RiskEngine, Contracts, or Infrastructure.

### Shared Market Data (Analytics Token + Redis)

All LTP ticks flow through a single shared Upstox WebSocket connection managed by the Worker process — not per-user connections. This eliminates WebSocket slot exhaustion regardless of how many browser tabs or risk users are active.

```
Worker process
  └── MarketDataService  (IHostedService, KAITerminal.MarketData, AddMarketDataProducer)
        └── UpstoxMarketDataStreamer  (single Upstox WebSocket, analytics token)
              LTP ticks
               └── Redis pub/sub "ltp:feed"
                     └── Api process
                           └── RedisLtpRelay  (IHostedService, KAITerminal.MarketData, AddMarketDataConsumer)
                                 └── ISharedMarketDataService.FeedReceived event
                                       ├── PositionStreamCoordinator (per browser tab)
                                       ├── IndexHub (live index quotes)
                                       └── StreamingRiskWorker
```

The `ISharedMarketDataService` interface (defined in `KAITerminal.Contracts`) decouples all consumers from the underlying transport. In the Worker it is backed by `MarketDataService` (live WebSocket); in the Api by `RedisLtpRelay` (Redis subscriber). Swapping to TrueData or an NSE direct feed requires only a new `ISharedMarketDataService` implementation — zero changes to the risk engine, hubs, or any consumer.

Market data services (`IMarketQuoteService`, `IChartDataService`, `IZerodhaInstrumentService`) and option contract/chain providers all live in `KAITerminal.MarketData` — the only project with market data HTTP calls. They use the admin analytics token stored via `AppSettingService`, resolved per-call via `IServiceScopeFactory`.

---

## Flows & In-Process State

Reference for all major in-process caches, Redis stores, and pub/sub channels. Use this when debugging data freshness issues or cross-process communication.

### In-Memory Caches

#### `MasterDataService` — `IMemoryCache`

**Project:** `KAITerminal.Api`

| Field | Value |
|---|---|
| **Key** | `contracts:{broker}:{date}` (e.g. `contracts:upstox:2025-03-25`) |
| **Value** | `IReadOnlyList<IndexContracts>` — merged option contracts across brokers |
| **Expiry** | Absolute — **8:15 AM IST daily** (pre-market refresh before the 9:15 open) |

- Multi-broker merge joins on `ExchangeToken` — the universal cross-broker identifier.
- When both Upstox and Zerodha results are present, `MergeAll` fills both `UpstoxToken` and `ZerodhaToken` on each `ContractEntry`.
- On API restart contracts are re-fetched from the broker on the first request (cache is cold).

#### `PositionCache` — `ConcurrentDictionary`

**Project:** `KAITerminal.RiskEngine`

| Field | Value |
|---|---|
| **Key** | `userId` |
| **Value** | `{ Positions: volatile IReadOnlyList<Position>, Ltp: ConcurrentDictionary<instrumentToken, decimal> }` |
| **Expiry** | None — process lifetime |

- `Ltp` dict is **cleared on every `UpdatePositions()` call** — prevents stale prices after a position is closed.
- MTM formula: `p.Pnl + p.Quantity * (liveLtp - p.Ltp)` — broker-authoritative P&L as baseline; live LTP delta applied on each tick.
- This formula is **identical** to the frontend `ReceiveLtpBatch` handler — both compute the same MTM independently.

#### `PositionStreamCoordinator` — per-connection in-process state

**Project:** `KAITerminal.Api`

Subscription state is managed by two collaborating classes in `Hubs/`:
- `UpstoxFeedSubscriptionManager` — owns `ConcurrentDictionary<string, bool>` of subscribed Upstox feed tokens.
- `ZerodhaFeedSubscriptionManager` — owns `ConcurrentDictionary<feedToken, nativeToken>` reverse map for `ReceiveLtpBatch`.

**Lifetime:** Created in `PositionsHub.OnConnectedAsync`; disposed in `PositionStreamManager` on SignalR disconnect.

- Feed tokens for Zerodha instruments are `NSE_FO|{exchangeToken}` / `BSE_FO|{exchangeToken}` — subscribed to the shared Upstox market-data WebSocket.
- On each `LtpUpdate`, the coordinator translates feed tokens back to native Zerodha trading symbols before pushing `ReceiveLtpBatch`.
- Order status updates are **pushed via broker webhooks** (not polled). `PositionStreamManager.GetAllForUser(username)` and `GetAllForBroker(brokerType)` route webhook payloads to the right coordinator(s).

#### `PositionStreamManager` + `IndexStreamManager` — `ConcurrentDictionary`

**Project:** `KAITerminal.Api`

| Manager | Key | Value |
|---|---|---|
| `PositionStreamManager` | `connectionId` | `PositionStreamCoordinator` (`IAsyncDisposable`) |
| `IndexStreamManager` | `connectionId` | `EventHandler<LtpUpdate>` |

**Lifetime:** Entry added on hub connect; removed and disposed on disconnect.

> [!NOTE]
> `ISharedMarketDataService` is subscribed to by both `PositionsHub` and `IndexHub` — they share the **same** WebSocket slot. Upstox allows only **2 market data WebSocket connections** per access token. Slot 1 = `PositionsHub` + `IndexHub` (shared). Slot 2 = `StreamingRiskWorker`.

#### `StreamingRiskWorker` — `ConcurrentDictionary` + `Dictionary`

**Project:** `KAITerminal.RiskEngine`

```
_gates:    ConcurrentDictionary<userId, UserGate>              // in StreamingRiskWorker
           UserGate {
             SemaphoreSlim Semaphore      // serialises concurrent LTP evaluations per user
             long LastLtpEvalTicks        // rate-limit — skips eval if < LtpEvalMinIntervalMs (15s)
           }

_sessions: ConcurrentDictionary<"{userId}::{brokerType}", SessionEntry>  // in UserSessionRegistry
           SessionEntry {
             CancellationTokenSource Cts
             Task                    Task
             UserConfig              Config
           }
```

A session key includes `brokerType` — one session per user per broker (e.g. `user@email.com::upstox`).

### Redis

#### `RedisRiskRepository` — Redis string (persistent across restarts)

**Project:** `KAITerminal.RiskEngine`

| Field | Value |
|---|---|
| **Key** | `risk-state:{userId}` |
| **Value** | JSON-serialised `UserRiskState` |
| **Expiry** | Indefinite |

```
UserRiskState {
  LastSessionDate:      DateOnly          // detects new trading day → auto-reset
  IsSquaredOff:         bool
  TrailingActive:       bool
  TrailingStop:         decimal           // current TSL floor (₹)
  TrailingLastTrigger:  decimal           // MTM at which TSL was last raised
  AutoShiftCounts:      Dictionary<chainKey, int>
  ShiftOriginMap:       Dictionary<token, chainKey>
  ExitedChainKeys:      HashSet<chainKey>
}
```

Survives Worker restarts — prevents TSL re-activation and duplicate square-off within the same trading day. `LastSessionDate` detects a new trading day on startup and resets state automatically.

#### `MarketDataService` + `RedisLtpRelay` — Redis pub/sub

| Channel | Direction | Message format |
|---|---|---|
| `ltp:feed` | Worker → Api | `JSON Dictionary<token, decimal>` — every Upstox WebSocket tick |
| `ltp:sub-req` | Api → Worker | `JSON List<string>` — tokens the Api wants subscribed on the Worker's WebSocket |

No key-value storage — pub/sub only; messages are fire-and-forget.

**Flow:**
1. SignalR client connects → `PositionStreamCoordinator` publishes token list to `ltp:sub-req`.
2. Worker receives request → subscribes new tokens to the Upstox WebSocket.
3. Worker receives tick → publishes to `ltp:feed`.
4. Api subscribes tick → forwards to `ISharedMarketDataService` → all connected coordinators.

#### `AppSettingService` — Redis L1 + PostgreSQL L2

| Field | Value |
|---|---|
| **Key** | `appsetting:{key}` (e.g. `appsetting:UpstoxAnalyticsToken`) |
| **Expiry** | Indefinite |

Read-through: check Redis → fall back to PostgreSQL → populate Redis on miss. Write-through: DB update always precedes Redis update.

### State Summary

| Component | Type | Key format | Expiry |
|---|---|---|---|
| `MasterDataService` | `IMemoryCache` | `contracts:{broker}:{date}` | 8:15 AM IST daily |
| `PositionCache` | `ConcurrentDictionary` | `userId` | Process lifetime |
| `PositionStreamCoordinator` | per-connection | — | On SignalR disconnect |
| `StreamingRiskWorker` | `ConcurrentDictionary` | `userId::broker` | Dynamic (60s DB refresh) |
| `RedisRiskRepository` | Redis string | `risk-state:{userId}` | Indefinite |
| `RedisLtpRelay` | Redis pub/sub | `ltp:feed`, `ltp:sub-req` | — (fire-and-forget) |
| `AppSettingService` | Redis L1 + PostgreSQL L2 | `appsetting:{key}` | Indefinite |

---

## API Reference

Interactive docs at `https://localhost:5001/scalar/v1` in development. OpenAPI spec at `/openapi/v1.json`.

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/google` | — | Start Google OAuth flow |
| `GET` | `/auth/google/callback` | — | OAuth callback; issues JWT, redirects to frontend |
| `GET` | `/api/profile` | JWT | Returns `{ name, email }` from JWT claims |

All endpoints below require `Authorization: Bearer <jwt>`.

### Upstox — Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upstox/access-token` | Exchange OAuth code for Upstox access token |

Request body: `{ "ApiKey", "ApiSecret", "RedirectUri", "Code" }` → Response: `{ "AccessToken" }`

All Upstox endpoints below also require the `X-Upstox-AccessToken` header (your daily Upstox token).

### Upstox — Positions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/upstox/positions` | All positions for the day (`?exchange=NFO,BFO` optional filter) |
| `GET` | `/api/upstox/mtm` | Total MTM P&L `{ "Mtm": decimal }` (`?exchange=` supported) |
| `POST` | `/api/upstox/positions/exit-all` | Exit all open positions |
| `POST` | `/api/upstox/positions/{instrumentToken}/exit` | Exit a single position |
| `POST` | `/api/upstox/positions/{instrumentToken}/convert` | Convert position between Intraday and Delivery |

Exit endpoints accept optional query params: `orderType` (Market/Limit/SL/SLM) and `product` (Intraday/Delivery/MTF/CoverOrder).

### Upstox — Orders

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/upstox/orders` | All orders for the day |
| `POST` | `/api/upstox/orders` | Place order (v2, returns `{ OrderId }`) |
| `POST` | `/api/upstox/orders/v3` | Place order (HFT v3, returns `{ OrderIds[], Latency }`) |
| `POST` | `/api/upstox/orders/cancel-all` | Cancel all pending orders |
| `DELETE` | `/api/upstox/orders/{orderId}` | Cancel a specific order |
| `DELETE` | `/api/upstox/orders/{orderId}/v3` | Cancel a specific order (HFT, returns latency) |

Place order request body:
```json
{
  "InstrumentToken": "NSE_FO|57352",
  "Quantity": 50,
  "TransactionType": "Buy | Sell",
  "OrderType": "Market | Limit | SL | SLM",
  "Product": "Intraday | Delivery | MTF | CoverOrder",
  "Validity": "Day | IOC",
  "Price": 0,
  "TriggerPrice": 0,
  "IsAmo": false,
  "Tag": null,
  "Slice": false
}
```

### Upstox — Options

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/upstox/options/chain` | Full option chain with live prices (`?underlyingKey=&expiryDate=`) |
| `GET` | `/api/upstox/options/contracts` | Option contract metadata — no live prices |
| `GET` | `/api/upstox/orders/by-option-price/resolve` | Resolve strike by target premium — no order placed |
| `POST` | `/api/upstox/orders/by-option-price` | Place order at strike nearest to target premium |
| `POST` | `/api/upstox/orders/by-option-price/v3` | Same, HFT v3 |
| `GET` | `/api/upstox/orders/by-strike/resolve` | Resolve strike by type (ATM/OTM/ITM) — no order placed |
| `POST` | `/api/upstox/orders/by-strike` | Place order at a named strike type |
| `POST` | `/api/upstox/orders/by-strike/v3` | Same, HFT v3 |
| `POST` | `/api/upstox/margin` | Get required margin for a list of positions |

Place-by-price request: `{ UnderlyingKey, ExpiryDate, OptionType (CE/PE), TargetPremium, PriceSearchMode (Nearest/GreaterThan/LessThan), Quantity, TransactionType, ... }`

Place-by-strike request: `{ UnderlyingKey, ExpiryDate, OptionType, StrikeType (ATM/OTM1–5/ITM1–5), Quantity, TransactionType, ... }`

Strike resolution rules:

| StrikeType | CE | PE |
|---|---|---|
| `ATM` | Closest strike to spot | Closest strike to spot |
| `OTM1`–`OTM5` | n strikes **above** ATM | n strikes **below** ATM |
| `ITM1`–`ITM5` | n strikes **below** ATM | n strikes **above** ATM |

### Zerodha

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/zerodha/auth-url` | Returns Kite Connect login URL (`?apiKey=`) |
| `POST` | `/api/zerodha/access-token` | Exchange `request_token` for access token |
| `GET` | `/api/zerodha/positions` | Zerodha open positions |
| `GET` | `/api/zerodha/orders` | Zerodha today's orders |
| `GET` | `/api/zerodha/funds` | Available margin + used margin |
| `POST` | `/api/zerodha/margin` | Basket margin for a list of hypothetical orders |

Zerodha endpoints require `X-Zerodha-Api-Key` and `X-Zerodha-Access-Token` headers.

### Master Data

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/masterdata/contracts` | Merged option contracts from all connected brokers |

Returns unified `ContractEntry` list with `UpstoxToken` and `ZerodhaToken` fields. Cached until 8:15 AM IST daily.

### Risk Configuration

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/risk-config` | Load Profit Protection config for current user |
| `PUT` | `/api/risk-config` | Save Profit Protection config for current user |

### AI Signals

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/ai/market-sentiment` | AI market signals from all 4 models in parallel |

Requires `X-Upstox-Access-Token` header. Fans out to GPT-4o, Grok, Gemini, and Claude (30s timeout each). Returns direction / confidence / reasons / support / resistance / watch_for per model.

### Frontend Log Relay

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/client-log` | Relay a frontend warn/error log to Serilog + Seq |

Body: `{ "level": "warn" | "error", "namespace": "BrokerAuth", "message": "..." }`. Requires JWT. Logs appear in Seq with `Source = 'Frontend'`.

### Internal (Worker → API)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/internal/risk-event` | Worker posts risk events here; relayed to browser via RiskHub |

Requires `X-Internal-Key` header matching `Api:InternalKey` secret. Returns 503 if key is not configured.

### WebSocket Hubs

| Hub | Path | Auth | Description |
|---|---|---|---|
| `PositionsHub` | `/hubs/positions` | `?upstoxToken=` and/or `?zerodhaToken=&zerodhaApiKey=` | Live positions + LTP |
| `IndexHub` | `/hubs/indices` | None (backend uses analytics token) | Live index quotes — works for all users regardless of broker |
| `RiskHub` | `/hubs/risk` | JWT Bearer via `?access_token=` | Risk event alerts — browser toasts |

### Diagnostics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/debug/claims` | JWT | Lists all claims in the current JWT (`Development` only) |

---

## Live Positions WebSocket

Real-time position data is delivered through the `PositionsHub` SignalR hub. All LTP ticks come from the single shared admin market data connection — no per-user broker WebSockets are opened.

### Architecture

```
Frontend (React)
  │  @microsoft/signalr
  │  WSS /hubs/positions?upstoxToken=...
  ▼
PositionsHub  (ASP.NET Core SignalR)
  └── PositionStreamCoordinator  (one per browser connection)
        ├── IBrokerClient.GetAllPositionsAsync()   ← REST poll every 10s → ReceivePositions
        ├── IBrokerClient.GetAllOrdersAsync()       ← REST poll every 10s → ReceiveOrderUpdate
        └── ISharedMarketDataService.FeedReceived   ← shared admin WebSocket fan-out
              filter to this connection's open instruments → ReceiveLtpBatch
```

Multiple browser tabs share the same underlying admin WebSocket — there is no per-tab broker connection and no WebSocket slot limit.

### Connection URL

```
WSS https://<host>/hubs/positions?upstoxToken=<upstox_access_token>[&exchange=NFO,BFO]
```

| Query param | Required | Description |
|---|---|---|
| `upstoxToken` | Yes | Upstox daily access token used for REST position/order calls. |
| `exchange` | No | Comma-separated exchange filter (e.g. `NFO,BFO`). Omit to receive all exchanges. |

### Server → Client Messages

| Message | Payload | When sent |
|---|---|---|
| `ReceivePositions` | `Position[]` | On connect + every 10s REST poll |
| `ReceiveLtpBatch` | `Array<{ instrumentToken, ltp }>` | On every market data tick for open instruments |
| `ReceiveOrderUpdate` | `{ orderId, status, statusMessage, tradingSymbol }` | When an order transitions to `complete` or `rejected` |

Frontend shows `toast.error` for `rejected` orders and `toast.success` for `complete`. The Orders panel auto-refreshes on every `ReceiveOrderUpdate`.

### Live P&L Calculation

When `ReceiveLtpBatch` arrives, the panel recomputes unrealised P&L locally without a REST round-trip:

```ts
const unrealised = position.quantity * (ltp - position.average_price);
const pnl = unrealised + position.realised;
```

`quantity` is negative for short positions — the formula correctly yields a gain for shorts when price falls.

### Exchange Filter

All position and MTM APIs (REST + SignalR) support server-side exchange filtering:

```
GET /api/upstox/positions?exchange=NFO,BFO     ← NFO + BFO positions only
GET /api/upstox/positions                       ← all exchanges

WSS /hubs/positions?upstoxToken=<token>&exchange=NFO,BFO
```

Supported exchanges: `NSE`, `BSE`, `NFO`, `BFO`, `MCX`, `CDS`.

---

## Profit Protection

The Worker process monitors every enabled user's MTM and fires exit orders automatically. Configure per user in **Settings → Profit Protection** (saved to DB via `PUT /api/risk-config`).

| Field | Description |
|---|---|
| MTM Stop Loss | Exit all if MTM ≤ this value (e.g. `−5000`) |
| MTM Target | Exit all if MTM ≥ this value (e.g. `25000`) |
| Auto Square-Off | Exit all at a configured IST time (set in Settings → Trading Settings) |
| Trailing SL enabled | Turn on the trailing stop loss |
| Activate at | TSL activates when MTM first reaches this level |
| Lock profit at | Floor is set to this value when TSL first activates |
| When profit increases by | Raise floor every time MTM gains this much from last step |
| Increase trailing by | Raise the floor by this amount per step |
| Auto Shift enabled | Automatically shift sell positions further OTM when premium rises |
| Threshold % | Shift when a sell position's LTP rises by this % from entry (e.g. `30`) |
| Max shifts | Exit the position after this many auto-shifts (e.g. `2`) |
| Strike gap | Number of strikes to move further OTM per shift (e.g. `1`) |

Checks run in order: **Hard SL → Target → Auto Square-Off → Trailing SL → Auto Shift** (per sell position).

### Trailing SL Example

```
MTM crosses TrailingActivateAt (+15,000)
  → floor locked at LockProfitAt (+3,025) — guaranteed regardless of entry MTM

MTM reaches +16,000 → gain=1,000 ≥ WhenProfitIncreasesBy
  → floor raised by IncreaseTrailingBy → floor=+3,525

MTM reaches +17,000 → gain=1,000
  → floor raised → floor=+4,025

MTM falls to +3,900 → 3,900 ≤ floor=+4,025 → TSL fires → exit all
```

The floor is set to `LockProfitAt` at activation — a fixed value, not relative to MTM at that moment.

### Risk State Persistence (Redis)

Trailing SL floor and squared-off flag are stored in Redis (`risk-state:{userId}`). This means:

- **Worker crash / restart** — TSL floor and `IsSquaredOff` survive. The session resumes with the same floor; no false re-entries.
- **New trading day** — state is reset automatically at session start if the stored date differs from today (IST). Each day begins clean.
- **Config change** — when Profit Protection settings are saved mid-session, the Worker detects the change within `UserRefreshIntervalMs` (default 60s), cancels the session, **resets the Redis state**, and restarts with the new thresholds. TSL floor from the old config does not carry over.

### Supervisor — Dynamic User Management

The Worker supervisor re-queries the DB every `UserRefreshIntervalMs` (default 60s):

| Scenario | Behaviour |
|---|---|
| New user added to `UserRiskConfigs` | Session starts automatically within 60s |
| User re-authenticates (fresh token today) | Session starts or resumes within 60s |
| Risk config changed (SL, target, trailing, auto-shift, etc.) | Session restarts with new config; Redis state cleared |
| Access token rotated (new `UpdatedAt`) | Session restarts with new token |
| User disabled or token is stale | Session stopped; no restart |

> [!IMPORTANT] Token Freshness
> Broker credentials are validated using `BrokerTokenHelper`. A token is considered valid only if it is non-empty (not blank or `"NA"`), and `BrokerCredentials.UpdatedAt` falls on or after **7:30 AM IST today**. Tokens from a previous day or updated before 7:30 AM IST are treated as absent — re-authenticate to resume. Upstox tokens are additionally validated by decoding the JWT and checking the `exp` claim.

### Risk Event Notifications

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
| Auto-shift triggered | Blue | A sell position was shifted further OTM automatically |
| Auto-shift exhausted | Orange | Max auto-shifts reached — position exited |

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

The `Api:InternalKey` user-secret must be set to the same value in both the Api and Worker processes. The `RiskHub` browser WebSocket consumes no broker connection slots.

### Risk Engine Configuration

The `RiskEngine` section in `KAITerminal.Worker/appsettings.json` controls worker behaviour (not per-user thresholds — those are in the DB):

```json
{
  "RiskEngine": {
    "TradingWindowStart":   "09:15:00",
    "TradingWindowEnd":     "15:30:00",
    "TradingTimeZone":      "Asia/Kolkata",
    "LtpEvalMinIntervalMs": 15000,
    "PositionPollIntervalMs": 30000,
    "UserRefreshIntervalMs":  60000,
    "Exchanges": ["NFO", "BFO"]
  }
}
```

| Key | Default | Meaning |
|---|---|---|
| `TradingWindowStart` / `TradingWindowEnd` | 09:15 / 15:30 | Risk evaluation only runs within this window |
| `TradingTimeZone` | `Asia/Kolkata` | IANA or Windows timezone ID |
| `LtpEvalMinIntervalMs` | 15,000 | Min ms between LTP-tick-triggered evaluations |
| `PositionPollIntervalMs` | 30,000 | How often positions are re-fetched via REST |
| `UserRefreshIntervalMs` | 60,000 | How often the supervisor re-queries DB for user/config changes |
| `Exchanges` | `["NFO","BFO"]` | Only positions from these exchanges are included in MTM |

The analytics token used by the shared market data connection is stored in the DB (`AppSettings` key `UpstoxAnalyticsToken`) — set it via the admin UI or `PUT /api/admin/analytics-token`.

### API Log Messages

Key operational events logged by the API process at `Information` level:

| Event | Level | Sample log message |
|---|---|---|
| OAuth login success | Info | `OAuth login — user@email.com (Full Name) authenticated — admin=False` |
| OAuth login — inactive user | Warn | `OAuth login — user@email.com is inactive, redirecting to /auth/inactive` |
| Upstox token generated | Info | `Upstox access token generated — user@email.com` |
| Zerodha token exchanged | Info | `Zerodha access token exchanged and persisted — user@email.com` |
| Broker credentials saved | Info | `Broker credentials saved — user@email.com (upstox)` |
| Order placed | Info | `Order placed — user@email.com — qty=50 NSE_FO|57352 Sell @ 120 — ids=[abc123] latency=4ms` |
| Order cancelled | Info | `Order cancelled — user@email.com — abc123 — latency=3ms` |
| Exit all positions | Info | `Exit all positions — user@email.com — filter: NFO,BFO` then `Exit all complete — 4 order(s) placed` |
| Exit single position | Info | `Exit position — user@email.com — NSE_FO|57352 (I) — order abc123` |
| Order COMPLETE/REJECTED | Info | `PositionStreamCoordinator [connId]: order COMPLETE — upstox abc123 NIFTY24...` |
| RiskHub connected | Info | `RiskHub: user@email.com connected — connId` |
| RiskHub rejected (no JWT user) | Warn | `RiskHub: connection connId rejected — no user identifier in JWT` |
| IndexHub snapshot sent | Info | `IndexHub [connId]: initial snapshot sent — 5 index/indices` |
| IndexHub no analytics token | Debug | `IndexHub [connId]: analytics token not configured — skipping initial snapshot` |

### Risk Engine Log Messages

All risk engine logs follow the format `{UserId} ({Broker})` and format monetary values as `₹+#,##0` / `₹-#,##0`.

| Event | Level | Sample log message |
|---|---|---|
| Worker startup | Info | `RiskWorker started — trading window 09:15–15:30 Asia/Kolkata, LTP eval every 15000ms` |
| Session starting | Info | `Starting session — user@email (upstox)` |
| New trading day reset | Info | `New trading day — resetting risk state for user@email (upstox)` |
| Streams live | Info | `Streams live — user@email (upstox)  watching 5 open instrument(s)` |
| Config changed | Info | `Stopping session (config changed) — user@email (upstox)` |
| Heartbeat (TSL off) | Info | `user@email (upstox)  PnL ₹+11,353  \|  SL ₹-5,000  \|  Target ₹+25,000  \|  TSL off — activates at ₹+15,000` |
| Heartbeat (TSL on) | Info | `user@email (upstox)  PnL ₹+11,353  \|  Target ₹+25,000  \|  TSL ₹+3,025` |
| TSL activated | Info | `TSL ACTIVATED — user@email (upstox)  floor locked at ₹+3,025` |
| TSL raised | Info | `TSL RAISED — user@email (upstox)  floor → ₹+5,025` |
| Target hit | Info | `TARGET HIT — user@email (upstox)  PnL ₹+25,000  ≥  Target ₹+25,000 — exiting all` |
| Hard SL hit | Warn | `HARD SL HIT — user@email (upstox)  PnL ₹-5,000  ≤  SL ₹-5,000 — exiting all` |
| TSL hit | Warn | `TSL HIT — user@email (upstox)  PnL ₹+3,000  ≤  floor ₹+3,025 — exiting all` |
| Square-off complete | Warn | `Square-off complete — user@email (upstox) — all positions exited` |
| Square-off failed | Error | `Square-off FAILED — user@email (upstox) — marked as squared-off; manual verification required` |
| Auto-shift triggered | Info | `AutoShift NIFTY_2026-04-17_PE: shift 1+1 — closing NFO\|NIFTY..., opening NFO\|NIFTY...` |
| Auto-shift exhausted | Warn | `AutoShift exhausted for user@email (upstox) — exiting NFO\|NIFTY... after 2 shifts` |
| Session crash + restart | Warn | `Restarting session — user@email (upstox) in 30s` |

---

## Upstox SDK

`KAITerminal.Upstox` is a .NET 10 class library wrapping the Upstox REST API for **execution**: auth, orders, positions, funds, and margin. Market data (quotes, candles, option chain/contracts, WebSocket feed) lives in `KAITerminal.MarketData`.

### Registration

```csharp
// Single-user (static token in config)
builder.Services.AddUpstoxSdk(builder.Configuration);

// Multi-user (per-call token via UpstoxTokenContext)
builder.Services.AddUpstoxSdk(cfg => { cfg.AutoReconnect = false; });
```

```json
{
  "Upstox": {
    "AccessToken": "daily_oauth_token",
    "AutoReconnect": true,
    "ReconnectIntervalSeconds": 3,
    "MaxReconnectAttempts": 5
  }
}
```

### Token Generation (OAuth 2.0)

```csharp
// Step 1: redirect user to Upstox login
// https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=...&redirect_uri=...

// Step 2: exchange the code returned in the redirect callback
TokenResponse token = await upstoxClient.GenerateTokenAsync(
    clientId:          "api_key",
    clientSecret:      "api_secret",
    redirectUri:       "https://your-app/callback",
    authorizationCode: "code_from_redirect");
```

### Per-call Token (Multi-user)

```csharp
// Token flows through all awaits via AsyncLocal
using (UpstoxTokenContext.Use(currentUser.UpstoxToken))
{
    var positions = await upstoxClient.GetAllPositionsAsync();
    var orders    = await upstoxClient.GetAllOrdersAsync();
}
```

### Market Data Streamer

The WebSocket feed is implemented by `UpstoxMarketDataStreamer` in `KAITerminal.MarketData`. In the application it is managed by `MarketDataService` (Worker) and consumed by `RedisLtpRelay` (Api), both via the `ISharedMarketDataService` interface.

| FeedMode | Data included |
|---|---|
| `Ltpc` | Last traded price, time, quantity, close price |
| `Full` | LTPC + 5-level depth + OHLC + ATP, VTT, OI, IV + greeks |
| `OptionGreeks` | LTPC + 1-level depth + greeks + VTT, OI, IV |
| `FullD30` | Same as Full but 30-level depth |

### Error Handling

All REST methods throw `UpstoxException` on API or network errors. WebSocket errors surface through the `Disconnected` event.

### Protobuf / Apple Silicon Note

`KAITerminal.MarketData/Protos/MarketDataFeedV3.cs` is pre-generated because `Grpc.Tools` does not ship a native `macosx_arm64` binary. If the `.proto` is modified, regenerate with:

```bash
brew install protobuf
protoc --csharp_out=KAITerminal.MarketData/Protos \
       --proto_path=KAITerminal.MarketData/Protos \
       KAITerminal.MarketData/Protos/MarketDataFeedV3.proto
```

Then update the namespace declaration at the top of the generated file to `KAITerminal.MarketData.Protos`.

---

## AI Signals

The `/ai-signals` page polls `GET /api/ai/market-sentiment` every 15 minutes (manual refresh also available). The endpoint:

1. Fetches live index quotes, NIFTY + BANKNIFTY option chains, and the last 30 × 1-min NIFTY candles
2. Fans out to GPT-4o, Grok, Gemini, and Claude in parallel (30s timeout each)
3. Each model returns: direction, confidence, reasons, support/resistance levels, what to watch for

Requires `X-Upstox-Access-Token` header and AI API keys set via `dotnet user-secrets` in `KAITerminal.Api`.

---

## Database

PostgreSQL via [Neon](https://neon.tech). Tables are created automatically on first startup via `EnsureCreatedAsync()` — no migrations needed. New tables/columns require manual SQL.

| Table | Purpose |
|---|---|
| `AppUsers` | User registry — `Email`, `IsActive`, `IsAdmin` |
| `BrokerCredentials` | Per-user broker API key + secret + access token (unique on `Username, BrokerName`). `UpdatedAt` is set to UTC now on every token save. |
| `UserTradingSettings` | Per-user trading preferences (underlying, expiry, auto square-off time) |
| `UserRiskConfigs` | Per-user profit protection config + `Enabled` flag (unique on `Username, BrokerType`) |
| `AppSettings` | Key-value store for admin settings (e.g. `UpstoxAnalyticsToken`) |

### Manual DB Steps

Fresh databases created by `EnsureCreatedAsync` get all tables automatically. If you are upgrading an existing database, run these manually:

```sql
-- AppSettings table
CREATE TABLE IF NOT EXISTS "AppSettings" (
  "Key"       text                     PRIMARY KEY,
  "Value"     text                     NOT NULL,
  "UpdatedAt" timestamp with time zone NOT NULL
);

-- UserRiskConfigs unique index (if upgrading from single-broker schema)
DROP INDEX IF EXISTS "ix_userriskconfigs_username";
CREATE UNIQUE INDEX IF NOT EXISTS "ix_userriskconfigs_username_broker"
  ON "UserRiskConfigs" ("Username", "BrokerType");

-- Auto-shift columns
ALTER TABLE "UserRiskConfigs"
  ADD COLUMN IF NOT EXISTS "AutoShiftEnabled"      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "AutoShiftThresholdPct" numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "AutoShiftMaxCount"     integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "AutoShiftStrikeGap"    integer NOT NULL DEFAULT 1;

-- BrokerUserId (for Upstox webhook routing)
ALTER TABLE "BrokerCredentials" ADD COLUMN IF NOT EXISTS "BrokerUserId" VARCHAR;

-- WatchedProducts
ALTER TABLE "UserRiskConfigs" ADD COLUMN IF NOT EXISTS "WatchedProducts" VARCHAR NOT NULL DEFAULT 'All';
```

---

## Logging & Observability

All three log sources — the Api process, the Worker process, and the React frontend — feed into the same **Serilog** + **Seq** pipeline. The `Source` property on every event tells you where it came from.

| `Source` value | Meaning |
|---|---|
| `Api` | Log from the ASP.NET Core API process |
| `Worker` | Log from the Risk Engine Worker process |
| `Frontend` | Log relayed from the React frontend via `POST /api/client-log` |

### Seq Filter Queries

Enter filter expressions in the Seq UI search bar (Events tab):

| Filter | Shows |
|---|---|
| `Source = 'Frontend'` | All frontend logs relayed to Seq |
| `Source = 'Api'` | All API process logs |
| `Source = 'Worker'` | All Worker process logs |
| `FrontendNamespace = 'BrokerAuth'` | Frontend logs from the broker auth flow |
| `FrontendNamespace = 'ApiClient'` | API request failures and 401s from the browser |
| `FrontendNamespace = 'AutoEntry'` | Auto-entry hook logs from the frontend |
| `@Level = 'Error'` | All errors across all sources |
| `Source = 'Frontend' and @Level = 'Error'` | Frontend errors only |
| `FrontendUser = 'user@email.com'` | All frontend logs for a specific user |

### Frontend Logging

Frontend code uses `createLogger(namespace)` from `lib/logger.ts`:

```ts
const log = createLogger("BrokerAuth");

log.debug("initiating OAuth flow");    // console only (suppressed in production)
log.info("OAuth flow started");        // console only (suppressed in production)
log.warn("token missing on load");     // console + relayed to Seq
log.error("OAuth callback failed", e); // console + relayed to Seq
```

`warn` and `error` calls are relayed to `POST /api/client-log` as fire-and-forget fetch — never blocks the UI. They appear in Seq with `Source = 'Frontend'`, `FrontendNamespace`, and `FrontendUser` properties. `debug` and `info` are console-only and suppressed entirely in production builds.

### Log Sinks

Both Api and Worker use two sinks:

- **Console** — structured text, always active
- **Seq** — structured log server at `http://localhost:5341` (local dev) or your hosted Seq instance. Serilog buffers and retries if Seq is unavailable — no logs are lost.

### Log Levels

**Worker** (`appsettings.json`):

| Namespace | Level |
|---|---|
| Default | `Information` |
| `Microsoft`, `System` | `Warning` |
| `KAITerminal.Upstox`, `KAITerminal.Zerodha` | `Warning` |

**API** (`appsettings.json`):

| Namespace | Level |
|---|---|
| Default | `Information` |
| `Microsoft`, `Microsoft.AspNetCore`, `Microsoft.EntityFrameworkCore`, `System` | `Warning` |

### Configuring Seq

Update `Serilog.WriteTo[Seq].serverUrl` in `appsettings.json` for both Api and Worker:

```json
"Serilog": {
  "WriteTo": [
    { "Name": "Seq", "Args": { "serverUrl": "http://your-seq-host:5341" } }
  ]
}
```

### Suggested Seq Alerts

| Alert | Signal |
|---|---|
| Risk engine down during market hours | No `"Market open"` event in 20-min window |
| Square-off failure | Any `"Square-off FAILED"` event |
| Session crash loop | More than 3 `"Restarting session"` events in 10 min |
| Auth failures | More than 5 `"Google OAuth callback failed"` events in 10 min |

### Troubleshooting

**Risk engine not evaluating despite open positions:**
1. Check for `Market closed` — `TradingWindowStart/End` or `TradingTimeZone` may be wrong.
2. Check for no active sessions — `UserRiskConfigs.Enabled` may be `false`, or the token `UpdatedAt` is not after 7:30 AM IST today (re-authenticate).
3. Check `MarketDataService` logs in the Worker — if the shared Upstox WebSocket is disconnected, no ticks reach the evaluator.

**User session not starting for a new user:**
1. Confirm `UserRiskConfigs.Enabled = true` and the broker credential was updated after 7:30 AM IST today.
2. Sessions start within `UserRefreshIntervalMs` (default 60s) — wait and check logs.

**Config change not taking effect:**
1. Save the new config via **Settings → Profit Protection**.
2. Within 60s the Worker logs `Stopping session (config changed)` then `Starting session`.

**Square-off did not happen / positions still open:**
1. Find `HARD SL HIT` / `TARGET HIT` / `TSL HIT` — confirms the trigger fired.
2. Check immediately after for `Square-off complete` or `Square-off FAILED`.
3. If `Square-off FAILED` — exit API call failed. **Manually close positions via the broker.** Engine will not retry.

---

## Production Deployment — Azure VM

This guide deploys KAI Terminal on a single Azure VM running Ubuntu 24.04 LTS. Follow the steps **in order** — the sequence matters (NSG before Certbot, DNS before Certbot, temp Nginx before Certbot).

### VM — D2as_v6

| Spec | Value |
|------|-------|
| vCPUs | 2 (AMD EPYC) |
| RAM | 8 GB |
| Storage | Standard SSD |

The app runs 5 processes (API + Worker + Redis + PostgreSQL + Nginx) which comfortably fit in 8 GB. Unlike the B-series, the D2as_v6 delivers full 2 vCPU performance at all times — no CPU credit throttling during sustained market-hours load.

> [!NOTE]
> D2as_v6 may have limited availability in Indian regions. Try **Central India** first. If unavailable, try `D2as_v4`, `D2s_v3`, or fall back to **UAE North** with D2as_v6.

### Architecture on the VM

```
Internet → Azure NSG → Nginx (443/80)
                         ├── /assets/*         → /var/www/kaiterminal (static files)
                         ├── /                 → /var/www/kaiterminal/index.html (SPA)
                         ├── /api/* /auth/*    → http://localhost:5001 (API)
                         └── /hubs/*           → http://localhost:5001 (SignalR WebSocket)

localhost:5001  KAITerminal.Api    (systemd: kaiterminal-api)
localhost:5341  KAITerminal.Worker (systemd: kaiterminal-worker)
localhost:6379  Redis              (systemd: redis)
localhost:5432  PostgreSQL         (systemd: postgresql)
localhost:8080  Seq                (Docker container, optional)
```

### Step 1 — Create VM and Connect

1. Azure Portal → Virtual Machines → Create → Ubuntu Server 24.04 LTS, D2as_v6, SSH key auth, username `azureuser`
2. Download the `.pem` file when prompted

```bash
mv ~/Downloads/kaiterminal_key.pem ~/.ssh/kaiterminal.pem
chmod 600 ~/.ssh/kaiterminal.pem
```

Add to `~/.ssh/config`:
```
Host kaiterminal
    HostName <vm-public-ip>
    User azureuser
    IdentityFile ~/.ssh/kaiterminal.pem
```

```bash
ssh kaiterminal
```

### Step 2 — Open Azure NSG Firewall Ports

In Azure Portal → VM → Networking → Inbound port rules:

| Priority | Service | Source | Action |
|----------|---------|--------|--------|
| 100 | SSH (22) | **Your IP only** | Allow |
| 110 | HTTP (80) | Any | Allow |
| 120 | HTTPS (443) | Any | Allow |
| 1000 | Any (*) | Any | Deny |

**Never expose ports 5001, 6379, 5341, or 8080 to the internet.**

### Step 3 — Configure DNS

In Hostinger (or your DNS provider), add A records pointing to your VM IP for `@` and `www` on each domain. Verify before proceeding to Certbot:

```bash
dig kaiterminal.com +short
dig www.kaiterminal.com +short
```

### Step 4 — Install Dependencies

```bash
# System update
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip

# .NET 10 SDK
wget -q https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh
chmod +x dotnet-install.sh
sudo ./dotnet-install.sh --channel 10.0 --install-dir /usr/share/dotnet
sudo ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server && sudo systemctl start redis-server

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql && sudo systemctl start postgresql

# Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx

# Docker (for Seq — optional)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Verify Redis is bound to localhost only:
```bash
sudo grep "^bind" /etc/redis/redis.conf
# should show: bind 127.0.0.1 -::1
```

### Step 5 — Create PostgreSQL Database

```bash
sudo -u postgres psql
```

```sql
CREATE USER kaiuser WITH PASSWORD 'your-strong-password';
CREATE DATABASE kaiterminal OWNER kaiuser;
GRANT ALL PRIVILEGES ON DATABASE kaiterminal TO kaiuser;
\q
```

### Step 6 — Set Up GitHub SSH Key on VM

```bash
ssh-keygen -t ed25519 -C "kaiterminal-vm"
cat ~/.ssh/id_ed25519.pub
```

Copy to **GitHub → Settings → SSH and GPG keys → New SSH key**.

### Step 7 — Create App User and Clone Repo

```bash
sudo useradd -r -s /bin/false -d /opt/kaiterminal kaiterm
sudo mkdir -p /opt/kaiterminal/{api,worker}
sudo mkdir -p /var/www/kaiterminal
sudo chown $USER:$USER /opt/kaiterminal

git clone git@github.com:suvrajitray/kai-terminal.git /opt/kaiterminal/repo
```

### Step 8 — SSL Certificates (Certbot)

Deploy a temporary minimal Nginx config first, then run Certbot:

```bash
sudo rm -f /etc/nginx/sites-enabled/default

sudo bash -c 'cat > /etc/nginx/sites-enabled/kaiterminal' << 'EOF'
server {
    listen 80;
    server_name kaiterminal.com www.kaiterminal.com kaiterminal.in www.kaiterminal.in;
    root /var/www/kaiterminal;
    location / { try_files $uri $uri/ /index.html; }
}
EOF

sudo nginx -t && sudo systemctl restart nginx

sudo certbot --nginx -d kaiterminal.com -d www.kaiterminal.com
sudo certbot --nginx -d kaiterminal.in -d www.kaiterminal.in
```

Then replace the temp config with the real one:

```bash
sudo cp /opt/kaiterminal/repo/deploy/nginx.conf /etc/nginx/sites-enabled/kaiterminal
sudo nginx -t && sudo systemctl restart nginx
```

### Step 9 — Secrets Configuration

```bash
sudo mkdir -p /etc/kaiterminal && sudo chmod 750 /etc/kaiterminal
```

**`/etc/kaiterminal/api.env`:**

```env
ConnectionStrings__DefaultConnection=Host=localhost;Database=kaiterminal;Username=kaiuser;Password=<db-password>
ConnectionStrings__Redis=localhost:6379
Jwt__Key=<random-256-bit-secret>
GoogleAuth__ClientId=<google-oauth-client-id>
GoogleAuth__ClientSecret=<google-oauth-client-secret>
Frontend__Url=https://kaiterminal.com
Api__InternalKey=<any-uuid>
Serilog__WriteTo__1__Args__serverUrl=http://localhost:5341
```

**`/etc/kaiterminal/worker.env`:**

```env
ConnectionStrings__DefaultConnection=Host=localhost;Database=kaiterminal;Username=kaiuser;Password=<db-password>
ConnectionStrings__Redis=localhost:6379
Api__InternalKey=<same-uuid-as-api>
Api__BaseUrl=http://localhost:5001
Serilog__WriteTo__1__Args__serverUrl=http://localhost:5341
```

```bash
sudo chmod 600 /etc/kaiterminal/api.env /etc/kaiterminal/worker.env
sudo chown root:kaiterm /etc/kaiterminal/api.env /etc/kaiterminal/worker.env
```

> [!IMPORTANT]
> `Api__InternalKey` must be **identical** in both files. `__` (double underscore) is the ASP.NET Core env var separator for nested keys.

### Step 10 — Build and Deploy

```bash
# Frontend
cd /opt/kaiterminal/repo/frontend
npm ci && npm run build
sudo cp -r dist/* /var/www/kaiterminal/
sudo chown -R www-data:www-data /var/www/kaiterminal

# API
cd /opt/kaiterminal/repo/backend
dotnet publish KAITerminal.Api -c Release -o /opt/kaiterminal/api
sudo chown -R kaiterm:kaiterm /opt/kaiterminal/api

# Worker
dotnet publish KAITerminal.Worker -c Release -o /opt/kaiterminal/worker
sudo chown -R kaiterm:kaiterm /opt/kaiterminal/worker
```

### Step 11 — Systemd Services

```bash
sudo cp /opt/kaiterminal/repo/deploy/kaiterminal-api.service    /etc/systemd/system/
sudo cp /opt/kaiterminal/repo/deploy/kaiterminal-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kaiterminal-api kaiterminal-worker
sudo systemctl start kaiterminal-api
sleep 5
sudo systemctl start kaiterminal-worker
```

Verify:
```bash
sudo systemctl status kaiterminal-api kaiterminal-worker
journalctl -u kaiterminal-api -f
```

### Step 12 — Daily Worker Reset Timer

The timer flushes all `risk-state:*` keys and restarts the Worker every morning at **8:30 AM IST (03:00 UTC)** — before market open.

```bash
sudo cp /opt/kaiterminal/repo/deploy/worker-daily-reset.sh /opt/kaiterminal/worker-daily-reset.sh
sudo chmod +x /opt/kaiterminal/worker-daily-reset.sh
sudo cp /opt/kaiterminal/repo/deploy/kaiterminal-worker-daily-reset.service /etc/systemd/system/
sudo cp /opt/kaiterminal/repo/deploy/kaiterminal-worker-daily-reset.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kaiterminal-worker-daily-reset.timer
```

The timer has `Persistent=true` — if the server was off at 03:00 UTC, the reset runs automatically on the next boot.

### Step 13 — UFW Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

### Step 14 — Google OAuth Redirect URIs

In Google Cloud Console → OAuth 2.0 credentials, add to **Authorized redirect URIs**:

```
https://kaiterminal.com/auth/callback
https://kaiterminal.in/auth/callback
```

### Step 15 — Seq (Optional)

```bash
docker run -d --name seq --restart unless-stopped \
  -p 127.0.0.1:5341:5341 \
  -p 127.0.0.1:8080:80 \
  -e ACCEPT_EULA=Y \
  -e SEQ_FIRSTRUN_ADMINPASSWORD=<choose-a-password> \
  -v /opt/seq-data:/data \
  datalust/seq:latest
```

Access via SSH tunnel from your Mac:
```bash
ssh -L 9080:localhost:8080 kaiterminal
# then open http://localhost:9080
```

After first login: **Settings → Retention → Add policy** → delete events older than 7 days. Monitor disk: `du -sh /opt/seq-data`.

### Deployment Checklist

- [ ] VM created (D2as_v6, Ubuntu 24.04 LTS); SSH key set up
- [ ] Azure NSG — SSH (your IP), HTTP/HTTPS (any), DenyAll configured
- [ ] DNS A records pointing to VM IP; propagation verified
- [ ] All dependencies installed
- [ ] PostgreSQL `kaiuser` + `kaiterminal` database created
- [ ] GitHub SSH key on VM and added to GitHub
- [ ] Certbot certificates issued for both domains
- [ ] `/etc/kaiterminal/api.env` and `worker.env` created with all secrets; `Api__InternalKey` identical
- [ ] Frontend + API + Worker built and deployed
- [ ] Systemd services enabled and started
- [ ] Daily reset timer installed
- [ ] UFW enabled
- [ ] Google OAuth redirect URIs updated
- [ ] Log in, set Upstox analytics token, restart Worker

### Deploying Updates

```bash
./deploy/deploy.sh             # full deploy (frontend + API + Worker)
./deploy/deploy.sh --frontend  # frontend only
./deploy/deploy.sh --backend   # API + Worker only
```

> [!WARNING]
> Restart the Worker **outside market hours** (before 9:00 AM or after 3:35 PM IST).

### Service Management

```bash
# Status
sudo systemctl status kaiterminal-api kaiterminal-worker redis postgresql nginx

# Restart
sudo systemctl restart kaiterminal-api
sudo systemctl restart kaiterminal-worker

# Live logs
journalctl -u kaiterminal-api -f
journalctl -u kaiterminal-worker -f

# Redis memory
redis-cli info memory | grep used_memory_human

# Disk space
df -h /
```

### Weekend Shutdown

Shutting down the VM over the weekend is safe. On Monday restart, all systemd services auto-start and the daily reset timer fires immediately (`Persistent=true`) — Redis state from Friday is flushed and the Worker restarts clean.

---

## AssetLens Deployment — assetlens.in (Same VM, Docker)

AssetLens is a FastAPI + SQLite portfolio tracker. It runs in a Docker container on the same VM as KAI Terminal — isolated from the main app, and trivial to tear down when no longer needed.

Docker is already on the VM (used for Seq).

### Architecture on the VM

```
Internet → Nginx (443/80)
             └── assetlens.in → http://127.0.0.1:8002 (Docker container)

Docker container: assetlens  (port 8002 on host)
/app/data/ inside container  SQLite databases (data lives in the container — fine for temp use)
```

### Step 1 — DNS (Hostinger)

In **Hostinger DNS** for `assetlens.in`, add A records pointing to the same VM IP:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `<vm-public-ip>` |
| A | `www` | `<vm-public-ip>` |

Verify before running Certbot:
```bash
dig assetlens.in +short
```

### Step 2 — Copy Code to VM

```bash
# On your Mac
scp -r assetlens/ kaiterminal:/opt/assetlens
```

### Step 3 — Configure Environment

`.env.production` is already created in the repo with all production values filled in and is copied to the VM as part of Step 2 (`scp`). No manual setup needed.

```bash
chmod 600 /opt/assetlens/.env.production
```

### Step 4 — Build and Run the Container

```bash
cd /opt/assetlens

# Build the image
docker build -t assetlens .

# Run the container
docker run -d \
  --name assetlens \
  --restart unless-stopped \
  -p 127.0.0.1:8002:8000 \
  --env-file .env.production \
  assetlens
```

Verify it's running:
```bash
docker ps
docker logs assetlens
```

### Step 5 — Nginx Server Block

```bash
sudo nano /etc/nginx/sites-available/assetlens
```

```nginx
server {
    listen 80;
    server_name assetlens.in www.assetlens.in;

    location / {
        proxy_pass http://127.0.0.1:8002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/assetlens /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Step 6 — SSL Certificate

```bash
sudo certbot --nginx -d assetlens.in -d www.assetlens.in
```

### Step 7 — Google OAuth Redirect URI

In Google Cloud Console → OAuth 2.0 credentials, add to **Authorized redirect URIs**:

```
https://assetlens.in/auth/callback
```

### Deploying Updates

```bash
ssh kaiterminal
cd /opt/assetlens

# Pull or copy new code, then rebuild
docker build -t assetlens .
docker stop assetlens && docker rm assetlens
docker run -d \
  --name assetlens \
  --restart unless-stopped \
  -p 127.0.0.1:8002:8000 \
  --env-file .env.production \
  assetlens
```

### Tearing Down (when done)

```bash
docker stop assetlens && docker rm assetlens
docker rmi assetlens
sudo rm /etc/nginx/sites-enabled/assetlens /etc/nginx/sites-available/assetlens
sudo nginx -t && sudo systemctl reload nginx
sudo rm -rf /opt/assetlens
```

### Container Management

```bash
docker ps                        # check running
docker logs assetlens -f         # live logs
docker restart assetlens         # restart
docker exec -it assetlens bash   # shell into container
```

---

## Configuration Reference

| File | Key settings |
|---|---|
| `backend/KAITerminal.Api/appsettings.json` | `Jwt:*`, `GoogleAuth:*`, `Frontend:Url`, `Upstox:ApiBaseUrl/HftBaseUrl`, `Api:InternalKey`, `AiSentiment:*`, `Serilog:*` |
| `backend/KAITerminal.Worker/appsettings.json` | `RiskEngine:*`, `Api:BaseUrl`, `Api:InternalKey`, `ConnectionStrings:DefaultConnection`, `Serilog:*` |
| `backend/KAITerminal.Console/appsettings.json` | `Upstox:AccessToken`, `RiskEngine:*` |
| `frontend/.env` | `VITE_API_URL`, `VITE_PP_MTM_TARGET`, `VITE_PP_MTM_SL`, other PP defaults |

`Frontend:Url` in the API config must match the frontend origin for CORS and OAuth redirects to work (default `http://localhost:3000`).

`ConnectionStrings:Redis` must be set via user-secrets in both `KAITerminal.Api` and `KAITerminal.Worker`.

---

## Development Commands

```bash
# Backend
cd backend
dotnet build                              # Build entire solution
dotnet watch --project KAITerminal.Api    # Hot-reload API
dotnet run --project KAITerminal.Api
dotnet run --project KAITerminal.Worker

# Frontend
cd frontend
npm run dev      # Dev server :3000
npm run build    # TypeScript check + production build
npm run lint     # ESLint

# Redis inspection
redis-cli keys "appsetting:*"
redis-cli get "appsetting:upstox_analytics_token"
redis-cli subscribe ltp:feed      # watch live LTP ticks (Worker → Api)
redis-cli subscribe ltp:sub-req   # watch subscription requests (Api → Worker)
redis-cli flushall                # clear all Redis data (dev reset)

# Services (macOS)
brew services list
brew services start redis
brew services start postgresql@18
docker start seq   # Seq UI at http://localhost:8080
```
