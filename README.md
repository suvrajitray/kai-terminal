# KAI Terminal

A full-stack options trading terminal built for **options sellers** in Indian equity derivatives (NFO/BFO). Live positions, real-time P&L, automated profit protection, AI market signals, and instant risk event alerts pushed to the browser the moment they fire.

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
- **Profit Protection** — backend Worker monitors MTM per user and fires exits on hard SL, target, or trailing SL
- **Auto Shift** — risk engine automatically shifts sell positions further OTM when premium rises by a configured %; exits the position after a configurable max number of shifts
- **Risk event alerts** — every risk trigger (SL hit, target hit, TSL activated/raised/fired, square-off, auto-shift) delivered as a browser toast in real time via a dedicated SignalR hub
- **Position shift** — manually shift any sell position up or down by a configurable strike gap; ↓ always means lower premium (safer/further OTM) for both CE and PE
- **Quick Trade** — place options orders by premium or by chain (straddle/strangle), for both Upstox and Zerodha, with live margin preview
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
│   │   ├── Services/              AdminMarketDataService, MasterDataService, …
│   │   └── Notifications/         SignalRRiskEventNotifier
│   ├── KAITerminal.Worker/        Multi-user risk engine host
│   │   └── Notifications/         HttpRiskEventNotifier
│   ├── KAITerminal.Console/       Single-user risk engine host
│   ├── KAITerminal.RiskEngine/    Risk logic library
│   │   ├── Services/              RiskEvaluator, RedisLtpRelay
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
│   ├── KAITerminal.MarketData/    Market data — quotes, candles, option chain/contracts, WebSocket feed, Kite CSV
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
- PostgreSQL 18 database ([Neon](https://neon.tech) free tier works, or local via `brew install postgresql@18`)
- Redis (`redis-server` locally, or any managed Redis)
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
dotnet user-secrets set "ConnectionStrings:Redis"    "localhost:6379"

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
dotnet user-secrets set "ConnectionStrings:Redis"    "localhost:6379"
dotnet user-secrets set "Api:InternalKey"  "<same-uuid-as-above>"
dotnet user-secrets set "Api:BaseUrl"      "https://localhost:5001"
dotnet user-secrets set "ApplicationInsights:ConnectionString" "..."
```

```bash
# Console (single-user alternative to Worker — optional)
cd ../KAITerminal.Console
dotnet user-secrets set "Upstox:AccessToken" "<your-daily-upstox-token>"
```

> **Admin broker account:** The API uses one shared Upstox connection for all market data. Set `AdminBroker:BrokerType` in `KAITerminal.Api/appsettings.json` (default `"upstox"`). The access token is read automatically from the `BrokerCredentials` DB table — whichever admin user authenticated with that broker most recently is used. No separate secret is needed.

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

Open four terminals:

```bash
# Terminal 1 — Redis
redis-server

# Terminal 2 — API (HTTPS :5001)
cd backend && dotnet run --project KAITerminal.Api

# Terminal 3 — Risk engine Worker (profit protection for all enabled users)
cd backend && dotnet run --project KAITerminal.Worker

# Terminal 4 — Frontend (http://localhost:3000)
cd frontend && npm run dev
```

Open `http://localhost:3000` and sign in with Google.

> **First login:** Your account is created with `IsActive=false`. The email `suvrajit.ray@gmail.com` is auto-activated as admin. All other users must be activated manually in the `AppUsers` table in the database.

---

## Connecting a Broker

### Upstox

1. **Settings → Brokers → Upstox** → enter API key + secret → **Save**
2. Click **Authenticate** → Upstox OAuth page opens → approve access
3. You are redirected back to `/redirect/upstox` which exchanges the code, saves the token to DB, and navigates to `/terminal`

> Upstox access tokens expire daily. Re-authenticate each morning before trading. The risk engine Worker automatically detects stale tokens (credentials not updated today) and excludes those users.

### Zerodha

1. **Settings → Brokers → Zerodha** → enter API key + secret → **Save**
2. `GET /api/zerodha/auth-url?apiKey=<key>` returns the Kite Connect login URL
3. After login you receive a `request_token` — exchange it: `POST /api/zerodha/access-token`

> Zerodha real-time streaming is not yet implemented. Position updates require a manual refresh. Risk monitoring for Zerodha users will not fire exit orders until streaming is added.

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

### Shared Market Data (Admin Account + Redis)

All LTP ticks flow through a single shared connection owned by an admin broker account — not per-user connections. This eliminates WebSocket slot exhaustion regardless of how many browser tabs or risk users are active.

```
Admin broker account (Upstox)
  └── AdminMarketDataService  (IHostedService, KAITerminal.Api)
        └── UpstoxMarketDataStreamer  (KAITerminal.MarketData, single WebSocket)
              LTP ticks
               ├── FeedReceived event  ──→  PositionStreamCoordinator (per browser tab)
               └── Redis pub/sub "ltp:feed"  ──→  Worker process
                                                     └── RedisLtpRelay (IHostedService)
                                                           └── FeedReceived event
                                                                 └── StreamingRiskWorker
```

The `ISharedMarketDataService` interface (defined in `KAITerminal.Contracts`) decouples all consumers from the underlying WebSocket implementation. Swapping to TrueData or an NSE direct feed requires only a new `ISharedMarketDataService` implementation — zero changes to the risk engine, hubs, or any consumer.

Market data services (`IMarketQuoteService`, `IChartDataService`, `IZerodhaInstrumentService`) and option contract/chain providers all live in `KAITerminal.MarketData` — the only project with market data HTTP calls. They use the admin analytics token, resolved per-call via `IServiceScopeFactory`.

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

Margin request body: `{ "Instruments": [{ "TradingSymbol", "Exchange", "TransactionType", "Product", "Quantity" }] }` → Response: `{ "requiredMargin", "finalMargin" }`

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
| Trailing SL enabled | Turn on the trailing stop loss |
| Activate at | TSL activates when MTM first reaches this level |
| Lock profit at | Floor is set to this value when TSL first activates |
| When profit increases by | Raise floor every time MTM gains this much from last step |
| Increase trailing by | Raise the floor by this amount per step |
| Auto Shift enabled | Automatically shift sell positions further OTM when premium rises |
| Threshold % | Shift when a sell position's LTP rises by this % from entry (e.g. `30`) |
| Max shifts | Exit the position after this many auto-shifts (e.g. `2`) |
| Strike gap | Number of strikes to move further OTM per shift (e.g. `1`) |

Checks run in order: **Hard SL → Target → Trailing SL → Auto Shift** (per sell position).

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
| User disabled or `UpdatedAt` is not today (IST) | Session stopped; no restart |

> **Token freshness:** Only credentials where `BrokerCredentials.UpdatedAt` falls on or after today's midnight IST are considered valid. A token from a previous day is treated as absent — re-authenticate to resume.

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

The `AdminBroker:BrokerType` key in `KAITerminal.Api/appsettings.json` sets which broker's admin account owns the shared market data connection (default `"upstox"`).

### API Log Messages

Key operational events logged by the API process at `Information` level (categories: `UpstoxEndpoints`, `ZerodhaEndpoints`, `BrokerCredentialsEndpoints`, `KAITerminal.Auth.AuthEndpoints`, `KAITerminal.Api.Hubs`):

| Event | Level | Sample log message |
|---|---|---|
| OAuth login success | Info | `OAuth login — user@email.com (Full Name) authenticated — admin=False` |
| OAuth login — inactive user | Warn | `OAuth login — user@email.com is inactive, redirecting to /auth/inactive` |
| OAuth callback failed | Warn | `Google OAuth callback failed — authentication result unsuccessful` |
| Upstox token generated | Info | `Upstox access token generated — user@email.com` |
| Zerodha token exchanged | Info | `Zerodha access token exchanged and persisted — user@email.com` |
| Broker credentials saved | Info | `Broker credentials saved — user@email.com (upstox)` |
| Broker token updated | Info | `Broker access token updated — user@email.com (zerodha)` |
| Broker credentials deleted | Info | `Broker credentials deleted — user@email.com (upstox)` |
| Order placed | Info | `Order placed — user@email.com — qty=50 NSE_FO|57352 Sell @ 120 — ids=[abc123] latency=4ms` |
| Order cancelled | Info | `Order cancelled — user@email.com — abc123 — latency=3ms` |
| Cancel all pending | Info | `Cancel all pending orders — user@email.com — 3 order(s) cancelled` |
| Exit all positions | Info | `Exit all positions — user@email.com — filter: NFO,BFO` then `Exit all complete — user@email.com — 4 order(s) placed` |
| Exit single position | Info | `Exit position — user@email.com — NSE_FO|57352 (I) — order abc123` |
| Convert position | Info | `Convert position — user@email.com — NSE_FO|57352 qty=50 from I` |
| Order COMPLETE/REJECTED | Info | `PositionStreamCoordinator [connId]: order COMPLETE — upstox abc123 NIFTY24... — ` |
| RiskHub connected | Info | `RiskHub: user@email.com connected — connId` |
| RiskHub disconnected | Info | `RiskHub: user@email.com disconnected — connId` |
| RiskHub rejected (no JWT user) | Warn | `RiskHub: connection connId rejected — no user identifier in JWT` |
| IndexHub snapshot sent | Info | `IndexHub [connId]: initial snapshot sent — 5 index/indices` |
| IndexHub subscribed | Info | `IndexHub [connId]: subscribed 5 index token(s) to shared feed` |
| IndexHub no analytics token | Debug | `IndexHub [connId]: analytics token not configured — skipping initial snapshot` |

### Risk Engine Log Messages

All risk engine logs follow the format `{UserId} ({Broker})` and format monetary values as `₹+#,##0` / `₹-#,##0`.

| Event | Level | Sample log message |
|---|---|---|
| Worker startup | Info | `RiskWorker started — trading window 09:15–15:30 Asia/Kolkata, LTP eval every 15000ms, position poll every 30000ms, user refresh every 60000ms` |
| Session starting | Info | `Starting session — user@email (upstox)` |
| New trading day reset | Info | `New trading day — resetting risk state for user@email (upstox)` |
| Streams live | Info | `Streams live — user@email (upstox)  watching 5 open instrument(s)` |
| Config changed | Info | `Stopping session (config changed) — user@email (upstox)` |
| User removed | Info | `Stopping session (disabled or token expired) — user@email (upstox)` |
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
| Auto-shift triggered | Info | `AutoShift NIFTY_2026-04-17_PE: shift 1+1 — closing NFO\|NIFTY..., opening NFO\|NIFTY...` |
| Auto-shift exhausted | Warn | `AutoShift exhausted for user@email (upstox) — exiting NFO\|NIFTY... after 2 shifts` |
| Auto-shift partial failure | Error | `AutoShift PARTIAL — close succeeded but open failed for user@email. Manual intervention required.` |
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

// Step 3: use token.AccessToken for all subsequent API calls
```

### Per-call Token (Multi-user)

```csharp
// Token flows through all awaits via AsyncLocal
using (UpstoxTokenContext.Use(currentUser.UpstoxToken))
{
    var positions = await upstoxClient.GetAllPositionsAsync();
    var orders    = await upstoxClient.GetAllOrdersAsync();
}

// WebSocket — token captured at connect time, reused on reconnects
using (UpstoxTokenContext.Use(currentUser.UpstoxToken))
    await streamer.ConnectAsync();
```

### Market Data Streamer

The WebSocket feed is implemented by `UpstoxMarketDataStreamer` in `KAITerminal.MarketData` — not in `KAITerminal.Upstox`. In the application it is managed exclusively by `AdminMarketDataService` via the `ISharedMarketDataService` interface.

| FeedMode | Data included |
|---|---|
| `Ltpc` | Last traded price, time, quantity, close price |
| `Full` | LTPC + 5-level depth + OHLC + ATP, VTT, OI, IV + greeks |
| `OptionGreeks` | LTPC + 1-level depth + greeks + VTT, OI, IV |
| `FullD30` | Same as Full but 30-level depth |

### Error Handling

All REST methods throw `UpstoxException` on API or network errors. WebSocket errors surface through the `Disconnected` event.

```csharp
try
{
    var result = await client.PlaceOrderAsync(request);
}
catch (UpstoxException ex)
{
    Console.WriteLine($"HTTP {ex.HttpStatusCode}  Code={ex.ErrorCode}  {ex.Message}");
}
```

### Protobuf / Apple Silicon Note

`KAITerminal.MarketData/Protos/MarketDataFeedV3.cs` is pre-generated (namespace `KAITerminal.MarketData.Protos`) because `Grpc.Tools` does not ship a native `macosx_arm64` binary. If the `.proto` is modified, regenerate with:

```bash
brew install protobuf
protoc --csharp_out=KAITerminal.MarketData/Protos \
       --proto_path=KAITerminal.MarketData/Protos \
       KAITerminal.MarketData/Protos/MarketDataFeedV3.proto
```

Then update the namespace declaration at the top of the generated file from the default to `KAITerminal.MarketData.Protos`.

---

## AI Signals

The `/ai-signals` page polls `GET /api/ai/market-sentiment` every 15 minutes (manual refresh also available). The endpoint:

1. Fetches live index quotes, NIFTY + BANKNIFTY option chains, and the last 30 × 1-min NIFTY candles
2. Fans out to GPT-4o, Grok, Gemini, and Claude in parallel (30s timeout each)
3. Each model returns: direction, confidence, reasons, support/resistance levels, what to watch for

Requires `X-Upstox-Access-Token` header and AI API keys set via `dotnet user-secrets` in `KAITerminal.Api`.

---

## Database

PostgreSQL via [Neon](https://neon.tech). Tables are created automatically on first startup via `EnsureCreatedAsync()` — no migrations needed. New tables/columns require manual SQL on Neon.

| Table | Purpose |
|---|---|
| `AppUsers` | User registry — `Email`, `IsActive`, `IsAdmin` |
| `BrokerCredentials` | Per-user broker API key + secret + access token (unique on `Username, BrokerName`). `UpdatedAt` is set to UTC now on every token save — used to detect stale tokens. |
| `UserTradingSettings` | Per-user trading preferences (underlying, expiry, etc.) |
| `UserRiskConfigs` | Per-user profit protection config + `Enabled` flag (unique on `Username, BrokerType`) |

---

## Logging & Observability

All backend logging uses `Microsoft.Extensions.Logging`. When `ApplicationInsights:ConnectionString` is set, logs are forwarded to Azure Application Insights. When unset, all logs go to console only — no configuration required for local development.

### Setting Up App Insights

```bash
# Set in each project that sends telemetry
dotnet user-secrets set "ApplicationInsights:ConnectionString" "InstrumentationKey=...;IngestionEndpoint=..."
```

App Insights registration is guarded by a connection string check — the SDK is only registered when the value is non-empty.

### How ILogger Maps to App Insights

| `ILogger` call | App Insights telemetry type |
|---|---|
| `LogDebug` / `LogInformation` / `LogWarning` | **Trace** (with corresponding severity level) |
| `LogError` / `LogCritical` | **Exception** (includes full stack trace) |

All structured log properties (e.g. `{UserId}`, `{Mtm}`) are promoted to custom dimensions — filterable in Log Analytics.

### Log Levels

**Worker / Console** (`appsettings.json`):
```json
"Logging": {
  "LogLevel": {
    "Default": "Information",
    "KAITerminal.RiskEngine": "Information",
    "KAITerminal.Upstox": "Warning"
  },
  "ApplicationInsights": {
    "LogLevel": {
      "Default": "Warning",
      "KAITerminal.RiskEngine": "Information",
      "KAITerminal.Upstox": "Warning"
    }
  }
}
```

App Insights receives all `KAITerminal.RiskEngine` logs at `Information+` — this captures the 15-second heartbeat, enabling **Azure Monitor availability alerts** (e.g. "alert if no heartbeat for 20+ minutes during market hours").

**API** (`appsettings.json`):
```json
"ApplicationInsights": {
  "LogLevel": {
    "Default": "Warning",
    "UpstoxEndpoints": "Information",
    "ZerodhaEndpoints": "Information",
    "BrokerCredentialsEndpoints": "Information",
    "KAITerminal.Auth.AuthEndpoints": "Information",
    "KAITerminal.Api.Hubs": "Information"
  }
}
```

This captures all order placement, exit, cancel, auth, and credential operations in App Insights while keeping noisy framework logs at `Warning`.

### Suggested Azure Monitor Alerts

| Alert | Condition |
|---|---|
| Risk engine down during market hours | No `"Market open"` trace in 20-min window |
| Square-off failure | Any `"Square-off FAILED"` trace |
| Session crash loop | More than 3 `"Restarting session"` traces in 10 min |
| High API error rate | More than 10 Upstox exceptions in 5 min |
| Repeated order rejections | More than 3 `"Order placed"` traces where response contains rejected status in 5 min |
| Auth failures | More than 5 `"Google OAuth callback failed"` traces in 10 min |

### Troubleshooting

**Risk engine not evaluating despite open positions:**
1. Check for `Market closed` — `TradingWindowStart/End` or `TradingTimeZone` may be wrong.
2. Check for no active sessions — `UserRiskConfigs.Enabled` may be `false`, or the token `UpdatedAt` is not today (re-authenticate).
3. Check `AdminMarketDataService` logs — if the admin LTP feed is disconnected, no ticks reach the evaluator.

**User session not starting for a new user:**
1. Confirm `UserRiskConfigs.Enabled = true` and the broker credential was updated today (IST).
2. Sessions start within `UserRefreshIntervalMs` (default 60s) — wait and check logs.

**Config change not taking effect:**
1. Save the new config via **Settings → Profit Protection**.
2. Within 60s the Worker logs `Stopping session (config changed)` then `Starting session`. The new thresholds are applied and risk state is cleared.

**Square-off did not happen / positions still open:**
1. Find `HARD SL HIT` / `TARGET HIT` / `TSL HIT` — confirms the trigger fired.
2. Check immediately after for `Square-off complete` or `Square-off FAILED`.
3. If `Square-off FAILED` — exit API call failed. **Manually close positions via the broker.** Engine will not retry.

**Trailing SL not activating:**
1. Confirm `TrailingEnabled: true` in `UserRiskConfigs`.
2. Watch heartbeat: `TSL off — activates at ₹{Threshold}` — `TrailingActivateAt` not reached yet.

**Yesterday's squared-off flag blocking today's session:**
This is handled automatically — the Worker resets Redis risk state at the start of each new trading day. If you suspect stale state, check Redis: `redis-cli GET "risk-state:user@email.com"` and inspect `lastSessionDate`.

---

## Hosting & Deployment

### Self-hosted (VPS / Docker)

No special configuration needed. Kestrel supports WebSockets natively.

#### Nginx reverse proxy

WebSocket upgrade headers are required:

```nginx
location / {
    proxy_pass         http://localhost:5001;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

Without `proxy_http_version 1.1` and the `Upgrade`/`Connection` headers, Nginx will close the WebSocket handshake with a 400 or silently downgrade to long-polling.

#### Caddy

Caddy proxies WebSockets automatically — no extra configuration required.

### Azure App Service

WebSockets are **disabled by default** on Azure App Service. Enable before deploying:

**Portal:** Web App → Configuration → General settings → **Web sockets: On** → Save

**Azure CLI:**
```bash
az webapp config set \
  --name <app-name> \
  --resource-group <resource-group> \
  --web-sockets-enabled true
```

**Scaling out:** ARR Affinity (enabled by default on App Service) provides sticky sessions automatically — no code changes needed for up to ~5 instances. For more instances, add Azure SignalR Service with a one-line change: `builder.Services.AddSignalR().AddAzureSignalR()`.

---

## Configuration Reference

| File | Key settings |
|---|---|
| `backend/KAITerminal.Api/appsettings.json` | `Jwt:*`, `GoogleAuth:*`, `Frontend:Url`, `Upstox:ApiBaseUrl/HftBaseUrl`, `Api:BaseUrl/InternalKey`, `AdminBroker:BrokerType`, `AiSentiment:*`, `ApplicationInsights:ConnectionString` |
| `backend/KAITerminal.Worker/appsettings.json` | `RiskEngine:*`, `Api:BaseUrl`, `Api:InternalKey`, `ConnectionStrings:DefaultConnection` |
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

# Frontend
cd frontend
npm run dev      # Dev server :3000
npm run build    # TypeScript check + production build
npm run lint     # ESLint
```
