# KAI Terminal

An algorithmic trading platform for Indian equity derivatives (NFO). Connects to Upstox, monitors positions in real time, and autonomously executes risk management actions.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | .NET 10, ASP.NET Core, EF Core, SQLite |
| Auth | Google OAuth 2.0, JWT (HS256) |
| Broker API | Upstox REST API v2, HFT order endpoint |
| Frontend | React 19, TypeScript, Vite |
| UI | TailwindCSS, shadcn/ui, Framer Motion |
| State | Zustand (persisted to localStorage) |

## Repository Layout

```
KAITerminal/
├── backend/          # .NET 10 solution (KAITerminal.slnx)
└── frontend/         # React 19 + Vite SPA
```

### Backend Projects

| Project | Role |
|---|---|
| `KAITerminal.Api` | ASP.NET Core REST API — auth, credentials, Upstox proxy endpoints |
| `KAITerminal.Worker` | Background worker host — runs the risk engine |
| `KAITerminal.Upstox` | Upstox broker implementation (HTTP client, protobuf models) |
| `KAITerminal.Infrastructure` | EF Core DbContext, database initialisation |
| `KAITerminal.Auth` | OAuth/JWT service registration helpers |
| `KAITerminal.Types` | Shared types across projects |
| `KAITerminal.Util` | Shared utility helpers |
| `KAITerminal.Console` | Ad-hoc/scratch runner |

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/) with npm

## Getting Started

### 1. Configure the API

Copy `appsettings.json` and populate secrets via `dotnet user-secrets` or directly in `appsettings.json`:

```bash
cd backend/KAITerminal.Api

dotnet user-secrets set "Jwt:Key" "<a-long-random-secret>"
dotnet user-secrets set "GoogleAuth:ClientId" "<your-google-client-id>"
dotnet user-secrets set "GoogleAuth:ClientSecret" "<your-google-client-secret>"
dotnet user-secrets set "Upstox:ApiKey" "<your-upstox-api-key>"
dotnet user-secrets set "Upstox:ApiSecret" "<your-upstox-api-secret>"
```

Set the Google OAuth redirect URI in the Google Cloud Console to:

```
https://localhost:5001/auth/google/callback
```

### 2. Run the Backend

```bash
cd backend

# Build the solution
dotnet build

# Run the REST API (HTTPS on :5001)
dotnet run --project KAITerminal.Api

# Run the risk engine worker
dotnet run --project KAITerminal.Worker
```

### 3. Run the Frontend

```bash
cd frontend

npm install
npm run dev        # Dev server on :3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

### Authentication

- **Google OAuth 2.0** — Sign in with Google; no separate account creation required.
- **JWT Sessions** — Backend issues a JWT after login, used for all subsequent API calls.
- **Persistent Sessions** — Auth state stored in `localStorage` across browser refreshes.

### Broker Integration

- **Upstox** — Fully integrated for live trading.
- **Per-user Credentials** — API Key and Secret stored per user in SQLite.
- **OAuth Token Exchange** — One-click flow to exchange an Upstox auth code for an access token.
- **Pluggable Design** — Interface-driven (`IPositionProvider`, `IOrderExecutor`, `ITokenGenerator`); new brokers can be added by implementing these interfaces.

### Position Management

- Live NFO position fetch from Upstox.
- Per-position details: Symbol, Option Type (CE/PE), Quantity, Average Price, LTP, P&L.
- Aggregated portfolio Mark-to-Market (MTM) P&L.

### Order Execution

- Market exit orders via the Upstox HFT endpoint.
- Direction-aware — automatically determines BUY or SELL based on position side.
- Bulk exit (all positions) or individual position exit.

### Risk Engine

The risk engine runs as background workers and acts autonomously without manual intervention.

**Portfolio-level risk** (60-second loop):

| Rule | Default Threshold | Action |
|---|---|---|
| Hard Stop Loss | MTM ≤ −₹25,000 | Square off all positions |
| Profit Target | MTM ≥ +₹25,000 | Square off all positions |
| Trailing Stop Loss | Activates at +₹5,000 MTM | Locks ₹2,000 at ₹5,000; raises by ₹500 per ₹1,000 gain |

**Per-strike risk** (5-second loop):

| Option Type | Threshold | Action |
|---|---|---|
| Call (CE) | Loss > 20% above entry | Exit position |
| Put (PE) | Loss > 30% above entry | Exit position |

After a strike stop loss triggers, the engine re-enters at the next OTM strike (100-point gap). Maximum 2 re-entries per symbol.

All risk thresholds are configured in `backend/KAITerminal.Worker/appsettings.json` under the `RiskEngine` section — no code changes required.

## Configuration Reference

| Location | Purpose |
|---|---|
| `backend/KAITerminal.Api/appsettings.json` | API secrets (JWT key, Google OAuth, Upstox credentials) |
| `backend/KAITerminal.Worker/appsettings.json` | Risk engine thresholds and Upstox access token |
| `frontend/.env` (optional) | `VITE_API_URL` — defaults to `https://localhost:5001` |

`Frontend:Url` in the API config must match the frontend origin (`http://localhost:3000`) for CORS and OAuth redirects to work.

## Frontend Commands

```bash
npm run dev        # Dev server on :3000
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

## Backend Commands

```bash
dotnet build                                 # Build entire solution
dotnet run --project KAITerminal.Api         # Run the REST API
dotnet run --project KAITerminal.Worker      # Run the risk engine worker
dotnet watch --project KAITerminal.Api       # Hot-reload dev server
```

## API Endpoints (key)

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google` | Initiate Google OAuth flow |
| `GET` | `/auth/google/callback` | OAuth callback; issues JWT |
| `GET` | `/api/upstox/positions` | Fetch open NFO positions |
| `GET` | `/api/upstox/mtm` | Portfolio MTM P&L |
| `GET` | `/debug/claims` | Inspect JWT claims (dev only) |

OpenAPI/Swagger docs are available at `https://localhost:5001/openapi` in development.

## Database

SQLite (`kai-terminal.db`) is created automatically alongside the running API binary. No external database server is required.
