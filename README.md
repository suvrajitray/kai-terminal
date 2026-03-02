# KAI Terminal

An algorithmic trading platform for Indian equity derivatives (NFO). Connects to Upstox, monitors positions in real time, and autonomously executes risk management actions.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | .NET 10, ASP.NET Core, EF Core, SQLite |
| Auth | Google OAuth 2.0, JWT (HS256) |
| Broker SDK | Upstox REST API v2/v3, HFT order endpoint |
| Frontend | React 19, TypeScript, Vite |
| UI | TailwindCSS, shadcn/ui, Framer Motion |
| State | Zustand (persisted to localStorage) |

---

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
| `KAITerminal.RiskEngine` | Risk engine library — portfolio + strike workers, all risk logic |
| `KAITerminal.Worker` | Multi-user worker host — runs the risk engine for configured users |
| `KAITerminal.Console` | Single-user console host — developer's own Upstox token |
| `KAITerminal.SimConsole` | Simulation host — random PnL walk, no broker connection needed |
| `KAITerminal.Upstox` | Upstox SDK — HTTP client, WebSocket streamers, order/position services |
| `KAITerminal.Infrastructure` | EF Core DbContext, database initialisation |
| `KAITerminal.Auth` | OAuth/JWT service registration helpers |
| `KAITerminal.Types` | Shared types across projects |
| `KAITerminal.Util` | Shared utility helpers |

---

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/) with npm

---

## Getting Started

### 1. Configure the API

Populate secrets via `dotnet user-secrets` or directly in `appsettings.json`:

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

# Build the entire solution
dotnet build

# REST API (HTTPS on :5001)
dotnet run --project KAITerminal.Api

# Risk engine — multi-user (tokens in appsettings or user-secrets)
dotnet run --project KAITerminal.Worker

# Risk engine — single user (your own Upstox token)
dotnet run --project KAITerminal.Console

# Simulation — no broker required, random PnL walk
dotnet run --project KAITerminal.SimConsole
```

### 3. Run the Frontend

```bash
cd frontend

npm install
npm run dev        # Dev server on :3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Features

### Authentication

- **Google OAuth 2.0** — Sign in with Google; no separate account creation required.
- **JWT Sessions** — Backend issues a JWT after login, used for all subsequent API calls.
- **Persistent Sessions** — Auth state stored in `localStorage` across browser refreshes.

### Broker Integration

- **Upstox SDK** — Full REST v2/v3 + WebSocket integration via `KAITerminal.Upstox`.
- **Per-user Credentials** — API Key and Secret stored per user in SQLite.
- **OAuth Token Exchange** — One-click flow to exchange an Upstox auth code for an access token.
- **Multi-user Token Scoping** — `UpstoxTokenContext.Use(token)` scopes API calls per user without thread contention.

### Risk Engine

See [backend/KAITerminal.RiskEngine/README.md](backend/KAITerminal.RiskEngine/README.md) for full details.

**Portfolio-level risk** (60-second loop):

| Rule | Default Threshold | Action |
|---|---|---|
| Hard Stop Loss | MTM ≤ −₹25,000 | Square off all positions |
| Profit Target | MTM ≥ +₹25,000 | Square off all positions |
| Trailing Stop Loss | Activates at +₹5,000 (`TSLActivateAt`) | Stop locked at ₹2,000 (`LockProfitAt`); raises ₹500 (`IncreaseTSLBy`) every ₹1,000 gain (`WhenProfitIncreasesBy`) |

**Per-strike risk** (5-second loop):

| Option | Threshold | Action |
|---|---|---|
| CE | Loss > 20% | Exit; re-enter OTM1 (max 2 re-entries) |
| PE | Loss > 30% | Exit; re-enter OTM1 (max 2 re-entries) |

All thresholds live in `appsettings.json` under `RiskEngine` — no code changes needed to tune them.

### Simulation

`KAITerminal.SimConsole` lets you run the full risk engine without a broker connection. PnL moves randomly ±₹1,500 per tick so every risk path (hard SL, profit target, trailing SL activation and hit) can be observed in the logs. After a square-off the engine auto-resets and starts a new cycle.

```bash
dotnet run --project KAITerminal.SimConsole
```

Sample output:
```
[sim-user]  PnL=+2100  SL=-25000  Target=+25000  TSL=inactive (activates at +5000)
[sim-user]  PnL=+5800  SL=-25000  Target=+25000  TSL=inactive (activates at +5000)
Trailing SL activated  stop locked at=+2000
[sim-user]  PnL=+7200  Target=+25000  TSL=+2000
Trailing SL raised  stop=+2500
[sim-user]  PnL=+7900  Target=+25000  TSL=+3000
[sim-user]  PnL=+2800  Target=+25000  TSL=+3000
Trailing SL hit  MTM=+2800  stop=+3000 — exiting all positions
[SIM] New cycle started
```

---

## Configuration Reference

| File | Purpose |
|---|---|
| `backend/KAITerminal.Api/appsettings.json` | API secrets — JWT key, Google OAuth, Upstox credentials |
| `backend/KAITerminal.Worker/appsettings.json` | Multi-user risk engine — Upstox base URLs, thresholds, `Users[]` list |
| `backend/KAITerminal.Console/appsettings.json` | Single-user risk engine — `Upstox:AccessToken`, thresholds |
| `backend/KAITerminal.SimConsole/appsettings.json` | Simulation — thresholds and loop intervals only |
| `frontend/.env` (optional) | `VITE_API_URL` — defaults to `https://localhost:5001` |

`Frontend:Url` in the API config must match the frontend origin (`http://localhost:3000`) for CORS and OAuth redirects to work.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google` | Initiate Google OAuth flow |
| `GET` | `/auth/google/callback` | OAuth callback; issues JWT |
| `GET` | `/api/upstox/positions` | Fetch open NFO positions |
| `GET` | `/api/upstox/mtm` | Portfolio MTM P&L |
| `GET` | `/debug/claims` | Inspect JWT claims (dev only) |

OpenAPI/Swagger docs: `https://localhost:5001/openapi` (development only).

---

## Frontend Commands

```bash
npm run dev        # Dev server on :3000
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

## Backend Commands

```bash
dotnet build                                   # Build entire solution
dotnet run --project KAITerminal.Api           # REST API
dotnet run --project KAITerminal.Worker        # Risk engine (multi-user)
dotnet run --project KAITerminal.Console       # Risk engine (single user)
dotnet run --project KAITerminal.SimConsole    # Risk engine (simulation)
dotnet watch --project KAITerminal.Api         # Hot-reload dev server
```

---

## Database

SQLite (`kai-terminal.db`) is created automatically alongside the running API binary. No external database server is required.
