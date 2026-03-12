# KAI Terminal — Features

---

## Authentication

### Google OAuth 2.0
- Sign in with Google — no separate account creation required.
- Backend issues a JWT after successful OAuth callback.
- All protected API endpoints require `Authorization: Bearer <jwt>`.

### Session Management
- JWT stored in `localStorage` via Zustand persist middleware (`kai-terminal-auth`).
- Sessions survive browser refresh.
- Logout clears all Zustand stores and `localStorage` entirely, then redirects to `/login`.

---

## Broker Integration

### Connect Upstox
- Users save their Upstox API Key and Secret via the Connect Brokers page.
- Credentials are stored per user (by email) in PostgreSQL (Neon).

### OAuth Token Exchange
- One-click broker login initiates Upstox OAuth.
- After redirect, the auth code is automatically exchanged for an access token via `POST /api/upstox/access-token`.
- The access token is persisted to the `BrokerCredentials` table via `PUT /api/broker-credentials/{brokerName}/access-token`.
- Access token is also stored in the browser's Zustand broker store for immediate use.

### Per-broker Credential Storage
- `BrokerCredentials` table stores: `Username`, `BrokerName`, `ApiKey`, `ApiSecret`, `AccessToken`, `CreatedAt`, `UpdatedAt`.
- `AccessToken` defaults to `"NA"` when not yet set.
- Credentials are upserted — re-saving updates existing records.
- Credentials can be deleted per broker.

### Multi-user Token Scoping
- `UpstoxTokenContext` (AsyncLocal) scopes all broker API calls to the requesting user's token per HTTP request — no cross-user token leakage.

---

## Live Positions

### Real-time Position Feed (SignalR)
- `PositionsPanel` connects to `WSS /hubs/positions` on mount using `@microsoft/signalr`.
- On connect, the hub fetches current positions and starts a per-connection `IPortfolioStreamer` + `IMarketDataStreamer`.
- **`ReceivePositions`** — full position list refresh (initial load + after every order or position event from the portfolio stream).
- **`ReceiveLtpBatch`** — in-place LTP and unrealised P&L updates for each instrument without a full refresh.
- **`ReceiveOrderUpdate`** — fired on every order event; triggers toast notifications and auto-refreshes the Orders panel.
- Disconnects and cleans up streamers when the component unmounts.
- Portfolio stream subscribes explicitly to `order` and `position` update types — Upstox requires explicit `update_types` params or no events are delivered.

### Order Update Notifications
- **Rejection toast** — `toast.error("Order rejected: <symbol> — <reason>")` shown immediately when Upstox rejects an order.
- **Fill toast** — `toast.success("Order filled: <symbol>")` shown when an order reaches `complete` status.
- **Orders panel auto-refresh** — the Orders panel reloads after every order event, keeping the status display current without manual refresh.

### Connection Status
- Live `Wifi` / `WifiOff` indicator shows WebSocket connection state.

### Exchange Filter
- Positions can be filtered by exchange (e.g. `NFO`, `BFO`) via a query parameter on both REST and WebSocket endpoints.
- Omitting the parameter returns all exchanges.

---

## Risk Engine

The risk engine runs as a background service (Worker or Console host) and autonomously protects capital without any manual intervention.

### Portfolio Risk — Overall Stop Loss
- Exits all positions immediately when portfolio MTM ≤ `OverallStopLoss` (default −₹25,000).

### Portfolio Risk — Profit Target
- Exits all positions immediately when portfolio MTM ≥ `ProfitTarget` (default +₹25,000).

### Portfolio Risk — Trailing Stop Loss
- **Activation**: arms when MTM ≥ `TrailingActivateAt` (default +₹5,000).
- **Lock**: trailing stop is locked at `LockProfitAt` (default +₹2,000) — a fixed guaranteed floor regardless of MTM at activation.
- **Step-up**: every time MTM gains `WhenProfitIncreasesBy` (default ₹1,000) from the last trigger, the stop rises by `IncreaseTrailingBy` (default ₹500).
- **Fire**: exits all positions when MTM falls to or below the trailing stop.
- Can be disabled entirely with `EnableTrailingStopLoss: false`.

### Per-strike Risk — CE/PE Stop Loss
- Monitors each open position every `StrikeCheckIntervalSeconds` (default 5 s).
- **CE**: exits if loss > `CeStopLossPercent` (default 20%) relative to avg entry price.
- **PE**: exits if loss > `PeStopLossPercent` (default 30%) relative to avg entry price.
- After exit, places a new OTM1 SELL order on the same underlying and expiry (re-entry).
- Re-entries are capped at `MaxReentries` (default 2) per symbol per session.
- Can be disabled entirely with `EnableStrikeWorker: false`.

### Multi-user Support
- `IUserTokenSource` decouples token supply from the engine.
- `ConfigTokenSource` (Worker) reads a `Users[]` list from config — runs the engine for all configured users concurrently.
- `SingleUserTokenSource` (Console) runs for a single developer token.

### Streaming Mode
- `EnableStreamingMode: true` switches from interval-based polling to event-driven evaluation triggered by Upstox WebSocket LTP ticks.
- `LtpEvalMinIntervalMs` (default 500 ms) throttles portfolio evaluations to avoid redundant checks on every tick.

### State
- All risk state (trailing stop level, squared-off flag, re-entry counts) is held in memory per user.
- State resets on host restart — intended for fresh setup each trading day.

### Configuration
All thresholds are in `appsettings.json` under `RiskEngine` — no code changes needed to tune them:

| Key | Default |
|---|---|
| `OverallStopLoss` | −25,000 |
| `ProfitTarget` | +25,000 |
| `TrailingActivateAt` | +5,000 |
| `LockProfitAt` | +2,000 |
| `WhenProfitIncreasesBy` | +1,000 |
| `IncreaseTrailingBy` | +500 |
| `CeStopLossPercent` | 0.20 (20%) |
| `PeStopLossPercent` | 0.30 (30%) |
| `MaxReentries` | 2 |
| `PortfolioCheckIntervalSeconds` | 60 |
| `StrikeCheckIntervalSeconds` | 5 |

---

## Order Management

### Place Orders
- `POST /api/upstox/orders/v3` — HFT v3 order placement (returns order IDs + latency).
- Supports all order types: `Market`, `Limit`, `SL`, `SLM`.
- Supports all products: `Intraday`, `Delivery`, `MTF`, `CoverOrder`.
- Supports validity: `Day`, `IOC`.

### Cancel Orders
- `POST /api/upstox/orders/cancel-all` — cancel all pending orders in one call.
- `DELETE /api/upstox/orders/{orderId}/v3` — cancel a specific order (HFT, returns latency).

### Exit Positions
- `POST /api/upstox/positions/exit-all` — exit all open positions (optionally filtered by exchange).
- `POST /api/upstox/positions/{instrumentToken}/exit` — exit a single position by instrument token.

---

## Options Trading

### Option Chain
- `GET /api/upstox/options/chain` — full option chain with live prices for a given underlying and expiry.
- `GET /api/upstox/options/contracts` — option contract metadata (no live prices); optionally filtered by expiry.
- `GET /api/upstox/options/contracts/current-month` — contracts expiring in the current calendar month.

### Place by Option Price
- Resolves the strike whose premium is nearest to (or above/below) a target price.
- `GET /api/upstox/orders/by-option-price/resolve` — preview the resolved strike without placing an order.
- `POST /api/upstox/orders/by-option-price/v3` — place the order at the resolved strike (HFT v3).
- `PriceSearchMode`: `Nearest` (default) | `GreaterThan` | `LessThan`.

### Place by Strike Type
- Resolves the strike by type: `ATM`, `OTM1`–`OTM5`, `ITM1`–`ITM5`.
- `GET /api/upstox/orders/by-strike/resolve` — preview the resolved strike without placing.
- `POST /api/upstox/orders/by-strike/v3` — place the order at the resolved strike (HFT v3).

---

## Frontend

### Pages

| Page | Route | Description |
|---|---|---|
| Login | `/login` | Google sign-in button |
| Auth Callback | `/auth/callback` | Receives JWT from OAuth redirect, stores it, navigates to dashboard |
| Dashboard | `/dashboard` | Overview page |
| Terminal | `/terminal` | Live trading terminal — positions, orders, profit protection |
| Connect Brokers | `/connect-brokers` | Add/remove broker credentials, initiate broker OAuth |
| Broker Redirect | `/redirect/:brokerId` | Handles OAuth redirect, exchanges code for access token |

All pages except `/login` and `/auth/callback` are protected — unauthenticated users are redirected to `/login`.

### Terminal
- Live positions panel with real-time LTP and P&L updates.
- Orders panel showing today's orders — auto-refreshes on every order event.
- Toast notifications for order rejections (with rejection reason) and fills.
- Stats bar showing portfolio-level MTM.
- Profit Protection panel for configuring risk thresholds.
- Broker auth required guard — prompts user to connect a broker if not yet authenticated.

### Profit Protection Panel (Frontend)
A client-side risk configuration UI that mirrors the backend risk engine settings:
- **MTM Target** — exit all when MTM reaches this profit (warns if target ≤ current MTM).
- **MTM Stop Loss** — exit all when MTM falls to this loss.
- **MTM Trailing** — toggle trailing SL on/off.
  - **Increase In Profit By** — step size: how much MTM must gain to trigger a SL raise.
  - **Trail MTM SL By** — how much the stop floor rises per step.
- Configuration persisted to `localStorage` via `kai-terminal-profit-protection` store.

### State Management
- Zustand stores with `persist` middleware:
  - `kai-terminal-auth` — user profile and JWT token.
  - `kai-terminal-brokers` — broker credentials and access tokens.
  - `kai-terminal-profit-protection` — profit protection thresholds.
- All stores and `localStorage` are cleared on logout.

---

## Database

- PostgreSQL hosted on [Neon](https://neon.tech).
- `BrokerCredentials` table created automatically on first API startup via `EnsureCreatedAsync()` — no manual migrations needed.
- Unique index on `(Username, BrokerName)` — one credential record per user per broker.
- Connection string configured via `ConnectionStrings:DefaultConnection` (stored in `dotnet user-secrets` for local dev).
