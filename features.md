# KAI Terminal — Features

KAI Terminal is an algorithmic trading platform for Indian equity derivatives (NFO). It connects to Upstox, monitors positions in real time, and automatically executes risk management actions.

---

## Authentication

- **Google OAuth 2.0** — Sign in with Google; no separate account creation needed.
- **JWT Sessions** — After Google login, the backend issues a JWT used for all subsequent API calls.
- **Protected Routes** — Dashboard and broker pages are inaccessible without a valid session.
- **Persistent Sessions** — Auth state is stored in `localStorage` so the user stays logged in across browser refreshes.

---

## Broker Integration

- **Upstox** — Fully integrated broker for live trading.
- **Per-user Credential Storage** — API Key and API Secret are saved per user in an SQLite database.
- **OAuth Token Exchange** — A one-click flow exchanges an Upstox authorization code for an access token.
- **Pluggable Broker Design** — The broker layer is interface-driven (`IPositionProvider`, `IOrderExecutor`, `ITokenGenerator`), ready to add more brokers.
- **Connect / Disconnect UI** — Broker cards show connection status; users can add credentials, edit them, or disconnect.

---

## Position Management

- **Live Position Fetch** — Pulls all open NFO positions from Upstox (`GET /api/upstox/positions`).
- **Position Details** — Each position shows Symbol, Option Type (CE/PE), Quantity, Average Price, LTP, and P&L.
- **Portfolio MTM** — Aggregated Mark-to-Market P&L across all open positions (`GET /api/upstox/mtm`).
- **NFO Filter** — Only NFO (derivatives) exchange positions are surfaced; equity holdings are excluded.

---

## Order Execution

- **Market Exit Orders** — Closes any open position with a market order via Upstox high-frequency endpoint.
- **Direction-Aware** — Automatically determines BUY or SELL based on current position side.
- **Exit All Positions** — Bulk-exits every open position in a strategy in a single call.
- **Exit Individual Position** — Closes a single specified position.

---

## Risk Engine (Automated)

The risk engine runs as background workers and takes autonomous action without manual intervention.

### Overall Portfolio Risk (runs every 60 seconds)

| Rule | Default Threshold | Action |
|---|---|---|
| Hard Stop Loss | MTM ≤ −25,000 | Square off all positions |
| Profit Target | MTM ≥ +25,000 | Square off all positions |
| Trailing Stop Loss | Activates at +5,000 MTM | Dynamically raises stop loss as profit grows |

**Trailing Stop Loss detail:**
- Locks in profit at ₹2,000 when MTM first crosses ₹5,000.
- Every ₹1,000 gain above the last trigger raises the trailing stop by ₹500.
- Protects accumulated profit without capping upside.

### Per-Strike Risk (runs every 5 seconds)

| Option Type | Stop Loss Threshold | Action |
|---|---|---|
| Call (CE) | Loss > 20% above entry | Exit that position |
| Put (PE) | Loss > 30% above entry | Exit that position |

**Automatic Re-entry:**
- After a strike stop loss triggers, the engine re-enters at the next OTM strike (100-point gap by default).
- Maximum 2 re-entries per symbol to prevent runaway losses.

### Strategy Lifecycle

- Multiple named strategies can run simultaneously.
- Strategies are activated on startup via configuration and can be activated/deactivated at runtime.
- Each strategy maintains isolated state: trailing status, squared-off flag, re-entry counts.

---

## Dashboard

- **Portfolio Stats** — Cards showing Portfolio Value, Today's P&L, Open Positions, and Pending Orders.
- **Real-time Awareness** — Data sourced directly from broker API on load.
- **Animated UI** — Smooth card transitions and loading states via Framer Motion.

---

## Broker Management UI

- **Broker Cards** — Visual grid listing supported brokers with features and connection status.
- **Connect Dialog** — Form to enter API Key and API Secret; displays the redirect URL to configure in the broker portal.
- **Settings Dialog** — Edit credentials or disconnect an existing broker with confirmation.
- **Copy Redirect URL** — One-click copy of the OAuth redirect URL needed during broker setup.

---

## Developer / Operational

- **OpenAPI / Swagger** — API documentation available in development.
- **Debug Claims Endpoint** — Inspect JWT claims during development (`/debug/claims`).
- **Credential Masking** — Access tokens are masked in all log output (only first/last 3 chars visible).
- **Configurable Risk Parameters** — All thresholds (stop loss, target, trailing levels, strike percentages) are set via `appsettings.json`; no code changes required to tune the engine.
- **SQLite Persistence** — Lightweight, file-based database (`kai-terminal.db`); no external database server needed.

---

## Tech Stack (summary)

| Layer | Technology |
|---|---|
| Backend | .NET 10, ASP.NET Core, EF Core, SQLite |
| Auth | Google OAuth 2.0, JWT (HS256) |
| Broker API | Upstox REST API v2, HFT order endpoint |
| Frontend | React 18, TypeScript, Vite |
| UI | TailwindCSS, shadcn/ui, Framer Motion |
| State | Zustand (persisted to localStorage) |
