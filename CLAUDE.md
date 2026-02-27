# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KAITerminal is a high-performance trading terminal for active intraday traders. It provides real-time market data, position monitoring, order execution, and automated risk management. Currently integrates with Zerodha (Kite Connect), with plans for Upstox and Dhan.

## Build & Run Commands

### Backend (.NET 10.0)

```bash
# Build entire solution
dotnet build backend/KAITerminal.slnx

# Run the Web API (port configured in launchSettings.json)
dotnet run --project backend/KAITerminal.Api

# Run the Risk Engine (standalone worker service)
dotnet run --project backend/KAITerminal.RiskEngine

# Run a specific project
dotnet run --project backend/KAITerminal.Console
```

### Frontend (React 19 + Vite 7)

```bash
cd frontend
npm install
npm run dev      # Dev server
npm run build    # TypeScript check + Vite build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Architecture

### Backend Solution Structure

```
KAITerminal.Api          → ASP.NET Core Minimal API (Google OAuth + JWT auth)
KAITerminal.RiskEngine   → Background worker service (risk evaluation, trailing SL state machine)
KAITerminal.Broker       → Broker integration layer (Zerodha implementations)
KAITerminal.Types        → Shared value objects (AccessToken)
KAITerminal.Auth         → Auth module (stub)
KAITerminal.Util         → Utilities (stub)
KAITerminal.Console      → Dev/test console app
```

### Project Dependency Graph

```
Api → Broker → Types
RiskEngine → Broker → Types
           → Types
```

### Key Design Patterns

- **Minimal APIs** — No controllers; routes defined directly in `Program.cs`
- **Interface-based broker abstraction** — `IPositionProvider`, `IOrderExecutor`, `ITokenGenerator` in `KAITerminal.Broker/Interfaces/` allow swapping broker implementations
- **Typed HttpClient** — `KiteConnectHttpClient` registered via DI with automatic auth header injection
- **In-memory repositories** — `InMemoryRiskRepository`, `InMemoryStrategyProvider`, `PriceCache` in the RiskEngine (no database yet)
- **BackgroundService workers** — `TickRiskWorker`, `RiskBackgroundWorker`, `StartupSeeder` run as hosted services in the RiskEngine
- **Value objects** — `AccessToken` in KAITerminal.Types with built-in masking

### Risk Engine Architecture

The risk engine runs independently as a worker service with these components:
- `RiskEvaluator` — Evaluates overall MTM stop loss, target, and trailing SL conditions
- `StrikeMonitor` / `OtmStrikeCalculator` — Option strike monitoring and OTM calculations
- `StrategyRiskState` — State machine tracking trailing SL activation, profit locking, and incremental adjustments
- `RiskConfig` — Hardcoded defaults in `StartupSeeder` (SL: -25000, Target: 25000, trailing activation at 5000 profit)

### Frontend

- **State management**: Zustand
- **Styling**: Tailwind CSS 4 with CSS variables + shadcn/ui components (in `src/components/ui/`)
- **Path alias**: `@/` maps to `src/` (configured in vite.config.ts and tsconfig.json)
- Frontend is early-stage — `App.tsx` is a placeholder; core trading UI not yet built

## API Endpoints (KAITerminal.Api)

- `GET /auth/google` — Initiate Google OAuth login
- `GET /auth/google/callback` — OAuth callback, returns JWT
- `GET /api/profile` — Authenticated user profile
- `GET /api/zerodha/positions` — Fetch open positions
- `GET /api/zerodha/mtm` — Current Mark-to-Market P&L
- `POST /api/zerodha/access-token` — Generate broker access token from request token

## Configuration

- Backend uses `appsettings.json` + user secrets for sensitive config (Zerodha API keys, JWT secrets)
- RiskEngine user secrets ID: `dotnet-KAITerminal.RiskEngine-1db36772-1c69-4682-ac5d-91054692d91f`
- Zerodha settings bound to `ZerodhaSettings` class (API key, secret, base URL, WebSocket URL)

## Notes

- No test projects exist yet
- No CI/CD or Docker configuration
- The `frontend-obsolete/` and `Requirement-obsolete.md` are archived legacy code
- Solution file uses the newer `.slnx` format (not `.sln`)
