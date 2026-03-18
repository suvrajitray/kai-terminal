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

### Multi-broker Architecture

KAI Terminal supports multiple simultaneous broker connections via a broker-agnostic abstraction layer (`KAITerminal.Broker`).

**`IBrokerClient`** — unified interface implemented by every broker adapter:
- `GetAllPositionsAsync()` — fetch open positions
- `GetTotalMtmAsync()` — total mark-to-market P&L
- `ExitAllPositionsAsync()` — square off all positions
- `ExitPositionAsync()` — exit a single position
- `PlaceOrderAsync()` — place an order
- `GetFundsAsync()` — fetch available and used margin
- `CreateMarketDataStreamer()` / `CreatePortfolioStreamer()` — live streaming

**`IBrokerClientFactory`** — resolves the correct adapter by broker type string (`"upstox"` | `"zerodha"`). Registered in both the API and Worker hosts.

**Broker adapters:**
- `UpstoxBrokerClient` — wraps `UpstoxClient`; uses `UpstoxTokenContext` (AsyncLocal) per call.
- `ZerodhaBrokerClient` — wraps `ZerodhaClient`; uses `ZerodhaTokenContext` (AsyncLocal, stores `(ApiKey, AccessToken)` tuple) per call.

### Connect Upstox
- Users save their Upstox API Key and Secret via the Connect Brokers page.
- Credentials are stored per user (by email) in PostgreSQL (Neon).

### Connect Zerodha (Kite Connect)
- Users save their Zerodha API Key and Secret via the Connect Brokers page.
- `GET /api/zerodha/auth-url?apiKey=` returns the Kite Connect login URL.
- After Kite OAuth redirect (delivers `request_token`), the frontend calls `POST /api/zerodha/access-token` with `{apiKey, apiSecret, requestToken}` to exchange for an `access_token` via SHA-256 checksum handshake.
- The token is persisted and stored in the browser Zustand broker store.
- `GET /api/zerodha/funds` returns available and used margin (`Authorization: token {api_key}:{access_token}`).
- **Zerodha streaming** — stubs exist for `KiteTickerStreamer` (IMarketDataStreamer) and `ZerodhaPortfolioStreamer` (IPortfolioStreamer); full KiteTicker WebSocket implementation is pending.

### OAuth Token Exchange
- Upstox: auth code exchanged via `POST /api/upstox/access-token`.
- Zerodha: request token exchanged via `POST /api/zerodha/access-token` (SHA-256 checksum required).
- All tokens persisted to `BrokerCredentials` table via `PUT /api/broker-credentials/{brokerName}/access-token`.
- Tokens stored in browser Zustand broker store for immediate use.
- `BrokerRedirectPage` (`/redirect/:brokerId`) handles both brokers: reads `code` for Upstox, `request_token` for Zerodha.

### Per-broker Credential Storage
- `BrokerCredentials` table: `Username`, `BrokerName`, `ApiKey`, `ApiSecret`, `AccessToken`, `CreatedAt`, `UpdatedAt`.
- Unique key on `(Username, BrokerName)` — one record per user per broker.
- `AccessToken` defaults to `"NA"` when not yet set.
- Credentials are upserted — re-saving updates existing records.
- Credentials can be deleted per broker.

### Multi-user Token Scoping
- `UpstoxTokenContext` (AsyncLocal) scopes all Upstox API calls to the requesting user's token per HTTP request.
- `ZerodhaTokenContext` (AsyncLocal) scopes all Zerodha API calls — stores `(ApiKey, AccessToken)` tuple, both required for the Kite `Authorization` header.
- Middleware in `Program.cs` sets the correct context per request path (`/api/upstox/*` or `/api/zerodha/*`).

### Broker Status Chips (Header)
- A chip is shown in the header for every broker that has credentials saved.
- **Green dot** = valid access token present (authenticated).
- **Muted dot** = credentials saved but no token (not yet logged in).
- Clicking a chip opens a popover showing available margin and a Disconnect button.
- `IndexTicker` and Quick Trade button are shown when any broker is authenticated.

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

### Multi-user, Multi-broker Support
- `IUserTokenSource` decouples token supply from the engine.
- `DbUserTokenSource` (Worker) reads `UserRiskConfigs WHERE Enabled=true` joined with `BrokerCredentials` on `(Username, BrokerType)` every tick — auto-picks up DB changes without restart.
- `SingleUserTokenSource` (Console) runs for a single developer token (Upstox only).
- `StreamingRiskWorker` uses `IBrokerClientFactory` to create the correct broker adapter per user session based on `UserConfig.BrokerType`.
- `RiskEvaluator` accepts `IBrokerClient` as a parameter — fully broker-agnostic; all position fetches and square-offs go through the interface.
- `UserRiskConfigs` table has a `BrokerType` column (default `"upstox"`) allowing separate risk configs per user per broker.

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
| Broker Redirect | `/redirect/:brokerId` | Handles OAuth redirect for Upstox (`code`) and Zerodha (`request_token`) |

All pages except `/login` and `/auth/callback` are protected — unauthenticated users are redirected to `/login`.

### Terminal
- Live positions panel with real-time LTP and P&L updates.
- Orders panel showing today's orders — auto-refreshes on every order event.
- Toast notifications for order rejections (with rejection reason) and fills.
- Stats bar showing portfolio-level MTM, session extremes (Peak/Trough), and available margin.
- **Multi-broker margin display** — stats bar shows `U ₹X · Z ₹Y` when both Upstox and Zerodha are authenticated; falls back to single-broker display when only one is connected.
- Profit Protection panel for configuring risk thresholds.
- Broker auth required guard — prompts user to connect a broker if not yet authenticated.

### Quick Trade
- Broker selector shown at the top of the Quick Trade dialog when more than one broker is connected — "Route via: Upstox / Zerodha".
- Defaults to Upstox if authenticated; falls back to Zerodha.
- By Price and By Chain tabs disabled for Zerodha selection (option-price order routing via Zerodha is pending).

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
- Tables are created automatically on first startup via `EnsureCreatedAsync()`. New columns/indexes require manual SQL — see `TODO.md`.
- Connection string configured via `ConnectionStrings:DefaultConnection` (stored in `dotnet user-secrets` for local dev).

| Table | Key | Notes |
|---|---|---|
| `BrokerCredentials` | `(Username, BrokerName)` unique | One credential record per user per broker |
| `UserRiskConfigs` | `(Username, BrokerType)` unique | One risk config per user per broker; `BrokerType` column requires manual `ALTER TABLE` on existing DB |
| `UserTradingSettings` | `Username` unique | Per-user expiry/underlying preferences |
| `AppUsers` | `Email` unique | User registry; `IsActive` gates JWT issuance |
