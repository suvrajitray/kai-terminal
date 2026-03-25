# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Backend (run from `backend/`)

```bash
dotnet build                              # Build entire solution

# Run hosts
dotnet run --project KAITerminal.Api      # REST API on HTTPS :5001
dotnet run --project KAITerminal.Worker   # Risk engine — multi-user
dotnet run --project KAITerminal.Console  # Risk engine — single user (your own token)

dotnet watch --project KAITerminal.Api    # Hot-reload dev server
```

No test project exists.

### Frontend (run from `frontend/`)

```bash
npm install
npm run dev        # Dev server on :3000
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
```

The frontend `@` alias resolves to `frontend/src/`.

---

## Backend Projects

| Project | SDK | Role |
|---|---|---|
| `KAITerminal.Api` | `Sdk.Web` | ASP.NET Core REST API — auth, credentials, broker endpoints, SignalR hubs |
| `KAITerminal.Worker` | `Sdk.Worker` | Multi-user risk engine host — reads enabled users from `UserRiskConfigs` DB table |
| `KAITerminal.Console` | `Sdk` | Single-user risk engine host — reads `Upstox:AccessToken` from config |
| `KAITerminal.RiskEngine` | Library | Risk engine library — all risk logic, workers, state |
| `KAITerminal.Contracts` | Library | Broker-agnostic domain types — `Position`, `BrokerFunds`, `BrokerOrderRequest`, streaming interfaces, option contract types, `IRiskEventNotifier` + `RiskNotification` |
| `KAITerminal.Broker` | Library | Broker abstraction — `IBrokerClient`, `IBrokerClientFactory` |
| `KAITerminal.Upstox` | Library | Upstox SDK — HTTP client, WebSocket streamers, order/option services; `UpstoxBrokerClient` implements `IBrokerClient` |
| `KAITerminal.Zerodha` | Library | Zerodha SDK — Kite Connect REST + streaming stubs; `ZerodhaBrokerClient` implements `IBrokerClient` |
| `KAITerminal.Infrastructure` | Library | EF Core `AppDbContext`, DB initialisation, PostgreSQL integration |
| `KAITerminal.Auth` | Library | OAuth/JWT service registration helpers |
| `KAITerminal.Types` | Library | Cross-project shared types |
| `KAITerminal.Util` | Library | Shared utilities |

**Dependency graph:**
```
KAITerminal.Contracts     (no deps — leaf node)
        ↑
KAITerminal.Broker        (Contracts)
        ↑
KAITerminal.Upstox        (Contracts + Broker; all Upstox-internal types stay private)
KAITerminal.Zerodha       (Contracts + Broker; all Zerodha-internal types stay private)
        ↑
KAITerminal.RiskEngine    (Contracts + Broker; zero Upstox/Zerodha deps)
KAITerminal.Api           (Contracts + Broker + Upstox + Zerodha + Infrastructure + Auth)

KAITerminal.Worker        ──► KAITerminal.RiskEngine
                          ──► KAITerminal.Infrastructure
KAITerminal.Console       ──► KAITerminal.RiskEngine
```

Adding a new broker (e.g. Dhan): create `KAITerminal.Dhan`, implement `IBrokerClient` + `IOptionContractProvider`, register in `BrokerExtensions`. Zero changes to RiskEngine, Broker, Contracts, or Infrastructure.

---

## Architecture

### API (`KAITerminal.Api`)

- `Program.cs` wires services via extension methods in `Extensions/` and maps endpoint groups in `Endpoints/`.
- Minimal-API style — no controllers.
- Auth flow: `GET /auth/google` → Google OAuth → `GET /auth/google/callback` → `UserService.EnsureExistsAsync` creates user if new → if `IsActive=false` redirects to `{Frontend:Url}/auth/inactive` (no JWT) → if active issues JWT with `isActive` + `isAdmin` claims → frontend redirected to `/auth/callback?token=<jwt>`. All subsequent API calls use `Authorization: Bearer <token>`.
- **User access control** — `AppUsers` table gates access. New users are created with `IsActive=false` on first login. `suvrajit.ray@gmail.com` is auto-activated as admin on first login. Inactive users are redirected to `/auth/inactive` before a JWT is issued. `ProtectedRoute` also checks the `isActive` claim from the stored JWT and redirects to `/auth/inactive` if false.
- `BrokerExtensions.AddBrokerServices()` registers both `AddUpstoxSdk()` and `AddZerodhaSdk()`, wires `IBrokerClientFactory` (maps `"upstox"` / `"zerodha"` strings to concrete client instances), and registers `UpstoxOptionContractProvider` + `ZerodhaOptionContractProvider` as `IOptionContractProvider`. Per-request middleware injects credentials into the correct ambient token context: `/api/upstox/*` reads `X-Upstox-Access-Token` → `UpstoxTokenContext.Use(token)`; `/api/zerodha/*` reads `X-Zerodha-Api-Key` + `X-Zerodha-Access-Token` → `ZerodhaTokenContext.Use(apiKey, token)`.
- **PositionsHub supports live LTP for both Upstox and Zerodha** — Upstox positions and order updates are streamed via the broker WebSocket. Zerodha LTP is sourced from the shared Upstox market-data feed using `exchange_token` mapping (see below). Zerodha portfolio/order streaming remains stubbed.
- Credentials (`Jwt:Key`, `GoogleAuth:ClientId/Secret`, `ConnectionStrings:DefaultConnection`) and `Frontend:Url` must be set in `appsettings.json` or `dotnet user-secrets` before the API starts.
- `Frontend:Url` (default `http://localhost:3000`) controls CORS allowed origins and the OAuth redirect.
- **Live positions** — `PositionsHub` (`Hubs/PositionsHub.cs`) is a SignalR hub mounted at `/hubs/positions`. On connect it builds a list of `IBrokerClient` for each authenticated broker present in the query params (Upstox and/or Zerodha), creates a `PositionStreamCoordinator` (`Hubs/PositionStreamCoordinator.cs`) for the connection, and pushes `ReceivePositions` / `ReceiveLtpBatch` / `ReceiveOrderUpdate` messages. The coordinator owns event wiring and all push logic for its connection lifetime. `PositionStreamManager` (singleton) tracks coordinators by connection ID and disposes them on disconnect.
- **Zerodha live LTP** — if the WebSocket URL includes `zerodhaToken` + `zerodhaApiKey` query params, `PositionsHub` fetches open Zerodha positions, looks up each instrument's `exchange_token` from the Kite CSV via `IZerodhaInstrumentService`, constructs Upstox feed tokens (`NSE_FO|{exchangeToken}` / `BSE_FO|{exchangeToken}`), and passes a `feedToken → nativeToken` map to `PositionStreamCoordinator`. The coordinator subscribes those feed tokens to the shared Upstox market-data stream and pushes `ReceiveLtpBatch` with native Zerodha tokens so the frontend `instrumentToken` match works without changes.
- **Index data hub** — `IndexHub` (`Hubs/IndexHub.cs`) is a SignalR hub mounted at `/hubs/indices`. On connect it makes one REST call for the OHLC snapshot (`prevClose = ltp - netChange` computed from snapshot), then subscribes the 5 index tokens to `ISharedMarketDataService` (shared Upstox WebSocket feed). Per-connection `FeedReceived` handler pushes `ReceiveIndexBatch` with `{ instrumentToken, ltp }` only; the frontend computes `netChange = ltp - prevClose` client-side.
- **Risk event notifications** — `RiskHub` (`Hubs/RiskHub.cs`) is a JWT-authenticated SignalR hub mounted at `/hubs/risk`. On connect the user (identified via `ClaimTypes.NameIdentifier` = email) is added to a SignalR group keyed by their email. `POST /api/internal/risk-event` (validated by `X-Internal-Key` header; returns 503 if key not configured) accepts a `RiskNotification` from the Worker and pushes `ReceiveRiskEvent` to the user's group. `SignalRRiskEventNotifier` (`Notifications/`) implements `IRiskEventNotifier` for the Api process. `Api:InternalKey` must be set via user-secrets in both Api and Worker.
- **Portfolio stream** — `IPortfolioStreamer.ConnectAsync(ct)` takes no update-type parameters; the Upstox implementation subscribes to `[Order, Position]` internally. Upstox requires explicit `update_types` query params on the authorize endpoint (omitting them delivers no events) — this is encapsulated inside `PortfolioStreamer.ConnectAsync`. The Upstox portfolio stream JSON frame uses `update_type` (not `type`) at the root — mapped to `PortfolioUpdate.UpdateType` at the SDK boundary.
- **Order update notifications** — `ReceiveOrderUpdate` is pushed to the frontend on every `update_type=order` event. Frontend shows `toast.error` for `rejected` status and `toast.success` for `complete`; the Orders panel auto-refreshes on every order event.
- **Exchange filter** — `GET /api/upstox/positions?exchange=NFO,BFO` and `GET /api/upstox/mtm?exchange=NFO,BFO` accept a comma-separated exchange list; the `PositionsHub` also accepts `?exchange=` on the WebSocket URL. Filtering is applied server-side; omit the param to receive all exchanges. Full WebSocket URL: `WSS /hubs/positions?upstoxToken=...&exchange=NFO,BFO[&zerodhaToken=...&zerodhaApiKey=...]`. See `docs/live-positions-websocket.md` for full protocol details.
- **API documentation** — Scalar UI served at `https://localhost:5001/scalar/v1` in development (DeepSpace theme). OpenAPI spec at `/openapi/v1.json`.

### API Contract Layer (`KAITerminal.Api/Contracts/` + `Mapping/`)

All `/api/{broker}/positions` and `/api/{broker}/orders` responses use unified camelCase DTOs — never broker-specific types. The broker is identified by the URL path, never in request or response bodies.

**Response DTOs** (`Contracts/Responses/`):
- `PositionResponse` — camelCase; fields: `exchange`, `instrumentToken`, `tradingSymbol`, `product` (`ProductType`), `quantity`, `buyQuantity`, `sellQuantity`, `averagePrice`, `ltp`, `pnl`, `unrealised`, `realised`, `buyPrice`, `sellPrice`, `buyValue`, `sellValue`, `broker` (string `"upstox"`/`"zerodha"`), `isOpen`
- `OrderResponse` — camelCase; fields: `orderId`, `exchangeOrderId`, `exchange`, `tradingSymbol`, `product` (`ProductType`), `orderType` (`TradeOrderType`), `transactionType` (`OrderSide`), `validity` (`OrderValidity`), `status`, `statusMessage`, `price`, `averagePrice`, `quantity`, `filledQuantity`, `pendingQuantity`, `tag`, `orderTimestamp`

**API Enums** (`Contracts/Enums/`) — all carry `[JsonConverter(typeof(JsonStringEnumConverter))]` so they always serialise as strings, never numbers:

| Enum | Values |
|---|---|
| `ProductType` | `Intraday`, `Delivery`, `Mtf`, `CoverOrder` |
| `OrderSide` | `Buy`, `Sell` |
| `TradeOrderType` | `Market`, `Limit`, `StopLoss`, `StopLossMarket` |
| `OrderValidity` | `Day`, `IOC` |

**`Mapping/PositionMapper.cs`** — static extension class (`internal`); `ToResponse()` overloads for both `Upstox.Models.Responses.Position` and `Contracts.Domain.Position`, plus `ToResponse()` for `Upstox.Models.Responses.Order`. Private parsers normalise broker-specific raw strings: `"I"/"MIS"/"NRML"` → `Intraday`, `"D"/"CNC"` → `Delivery`, `"BUY"` → `Buy`, `"SL-M"` → `StopLossMarket`, etc. Never import `KAITerminal.Upstox.Models.Enums` into `PositionMapper` — use only the API contract enums.

### Contracts (`KAITerminal.Contracts`)

Leaf-node library with no dependencies — defines all cross-project types:

- **`Domain/`** — `Position` (broker-agnostic; `Ltp` field = last REST-fetched price; `Broker` field = `"upstox"` / `"zerodha"`), `BrokerFunds`, `BrokerOrderRequest`
- **`Streaming/`** — `IMarketDataStreamer`, `IPortfolioStreamer`, `LtpUpdate(IReadOnlyDictionary<string,decimal> Ltps)`, `PortfolioUpdate(UpdateType, OrderId?, Status?, StatusMessage?, TradingSymbol?)`, `FeedMode` enum (Ltpc, Full)
- **`Options/`** — `IndexContracts`, `ContractEntry` (unified option contract format: `UpstoxToken` = Upstox feed token e.g. `"NSE_FO|885247"`, `ZerodhaToken` = Kite trading symbol e.g. `"NIFTY2641320700PE"` for order placement)
- **`Broker/`** — `IOptionContractProvider` (pluggable contract fetcher: `BrokerType` + `GetContractsAsync(accessToken, apiKey?, ct)`); `ITokenMappingProvider` (pluggable native→feed token supplier per non-Upstox broker: `BrokerType` + `GetNativeContractKeysAsync`); `NativeContractKey` record (`Segment`, `ExchangeToken`, `TradingSymbol`) — `TradingSymbol` serves as both the native key and the order placement symbol (`NativeToken` was removed)
- **`Streaming/`** (addition) — `ITokenMapper` (`EnsureReadyAsync(brokerType, ct)`, `ToFeedTokens`, `ToNativeToken`) — translates broker-native tokens to/from Upstox feed tokens; `IdentityTokenMapper` (no-op default, registered by `AddRiskEngine`)
- **`Notifications/`** — `IRiskEventNotifier` (single method `NotifyAsync(RiskNotification, ct)`), `RiskNotification` record (`UserId`, `Broker`, `Type`, `Mtm`, `Target?`, `Sl?`, `TslFloor?`, `OpenPositionCount?`, `Timestamp`), `RiskNotificationType` enum (`SessionStarted`, `HardSlHit`, `TargetHit`, `TslActivated`, `TslRaised`, `TslHit`, `SquareOffComplete`, `SquareOffFailed`). Lives in Contracts so both RiskEngine and Api can reference it without new project dependencies.

### Broker Abstraction (`KAITerminal.Broker`)

`IBrokerClient` is the broker-agnostic interface consumed by the risk engine and any broker-neutral code:
- `BrokerType` — `"upstox"` or `"zerodha"`
- `UseToken()` — returns a disposable scope that activates the user's credentials via the appropriate ambient token context
- `GetAllPositionsAsync` → `IReadOnlyList<Contracts.Domain.Position>`
- `GetTotalMtmAsync` / `ExitAllPositionsAsync` / `ExitPositionAsync` / `PlaceOrderAsync(BrokerOrderRequest)` / `GetFundsAsync` → `BrokerFunds`
- `CreateMarketDataStreamer()` → `Contracts.Streaming.IMarketDataStreamer`
- `CreatePortfolioStreamer()` → `Contracts.Streaming.IPortfolioStreamer`

`IBrokerClientFactory.Create(brokerType, accessToken, apiKey?)` — instantiates the right `IBrokerClient`. Registered as singleton in DI; Upstox is always available, Zerodha is registered only when `AddZerodhaSdk()` succeeds.

`UpstoxBrokerClient` lives in `KAITerminal.Upstox` (namespace `KAITerminal.Broker.Adapters`) — maps `Upstox.Models.Responses.Position` → `Contracts.Domain.Position` at the boundary. In `UpstoxBrokerClient.MapPosition`, `AveragePrice` is mapped from `sell_price` for short positions (qty < 0) and `buy_price` for long positions (qty > 0), falling back to `close_price`. This keeps the displayed avg consistent with Upstox's day P&L basis.

### Upstox SDK (`KAITerminal.Upstox`)

Layered: `UpstoxClient` (facade) → `IPositionService` / `IOrderService` / `IOptionService` / `IAuthService` / `IMarginService` → `UpstoxHttpClient` (internal HTTP layer) → Upstox REST API.

- **`UpstoxTokenContext`** — `AsyncLocal<string?>` ambient token. Use `UpstoxTokenContext.Use(token)` to scope all API calls within the block to a specific user without passing the token explicitly.
- **Three named `HttpClient`s**: `"UpstoxApi"` (read, REST), `"UpstoxHft"` (order writes, lower latency), `"UpstoxAuth"` (OAuth exchange only, no Bearer header).
- Register with `services.AddUpstoxSdk(configuration)` or `services.AddUpstoxSdk(cfg => { ... })`.
- `IOptionService` supports resolving strikes by premium (`PlaceOrderByOptionPriceAsync`, `GetOrderByOptionPriceAsync`) or by strike type (ATM/OTM1-5/ITM1-5: `PlaceOrderByStrikeV3Async`, `GetOrderByStrikeAsync`). `PriceSearchMode` enum controls option-price resolution: `Nearest` (default), `GreaterThan`, `LessThan`.
- `Get*` variants (e.g. `GetOrderByOptionPriceAsync`) resolve the strike and return the `PlaceOrderRequest` without placing it — use to inspect before committing.
- `IMarginService.GetRequiredMarginAsync(items)` — calls `POST /v2/charges/margin`; returns `RequiredMargin` and `FinalMargin`. Exposed via `UpstoxClient.GetRequiredMarginAsync`.
- `IPositionService.ConvertPositionAsync` — calls `PUT /v2/portfolio/convert-position`. Exposed at `POST /api/upstox/positions/{instrumentToken}/convert`.
- **`MarketDataStreamer`** implements `Contracts.Streaming.IMarketDataStreamer`. Internally has its own `FeedMode` enum (4 values: Ltpc, Full, OptionGreeks, FullD30) — aliased as `UpstoxFeedMode` inside the file to avoid conflict with `Contracts.Streaming.FeedMode` (2 values).
- **`PortfolioStreamer`** implements `Contracts.Streaming.IPortfolioStreamer`. `ConnectAsync(ct)` subscribes to `[Order, Position]` internally and fires `PortfolioUpdate` events.
- **`UpstoxOptionContractProvider`** (`Options/`) — implements `IOptionContractProvider`; fetches option contracts via `UpstoxClient.GetOptionContractsAsync` and maps to `Contracts.Options.IndexContracts`.

**Key internal files** (useful when modifying the SDK):
- `UpstoxClient.cs` — facade; all public entry points delegate here
- `Http/UpstoxHttpClient.cs` — wraps all REST calls; handles JSON, errors, envelope unwrapping; token exchange endpoint bypasses the envelope handler (raw JSON response)
- `Http/UpstoxAuthHandler.cs` — `DelegatingHandler`; injects `Authorization: Bearer` per request; reads `UpstoxTokenContext.Current` first, falls back to `UpstoxConfig.AccessToken`
- `Extensions/ServiceCollectionExtensions.cs` — `AddUpstoxSdk()` wires all services and named HttpClients
- `Protos/MarketDataFeedV3.cs` — pre-generated protobuf file; do not delete

**SDK design rules** (apply whenever modifying `KAITerminal.Upstox`):
- All public methods are `async Task<T>` and accept `CancellationToken`
- All API errors surface as `UpstoxException`; network errors propagate naturally; WebSocket errors go through the `Disconnected` event, never thrown
- Internal DTOs (e.g. `PlaceOrderDto`, `UpstoxEnvelope<T>`) live inside `UpstoxHttpClient.cs` as private nested classes — serialisation-only, never part of the public API
- `UpstoxTokenContext` is the **only** mechanism for per-call token injection — never add `accessToken` parameters to service or facade methods
- OAuth credentials (`clientId`, `clientSecret`, `redirectUri`) are **never** stored in `UpstoxConfig` — always passed as method parameters to `GenerateTokenAsync`
- Concurrent bulk operations use `Task.WhenAll()`
- `UpstoxHttpClient` is `internal` — expose new functionality via a public interface registered in DI

### Zerodha SDK (`KAITerminal.Zerodha`)

Layered: `ZerodhaClient` (facade) → `IZerodhaAuthService` / `IZerodhaPositionService` / `IZerodhaOrderService` / `IZerodhaFundsService` / `IZerodhaInstrumentService` → `ZerodhaHttpClient` → Kite Connect REST API.

- **`ZerodhaTokenContext`** — `AsyncLocal<(string ApiKey, string AccessToken)?>` ambient credentials (pair, not just a token). Use `ZerodhaTokenContext.Use(apiKey, accessToken)` to scope calls. `ZerodhaAuthHandler` injects `Authorization: token {apiKey}:{accessToken}` on every request.
- **Three named `HttpClient`s**: `"ZerodhaApi"` (authenticated REST), `"ZerodhaAuth"` (token exchange, no auth header), `"ZerodhaData"` (public instrument CSV downloads, no auth header).
- Register with `services.AddZerodhaSdk(configuration)`.
- `IZerodhaInstrumentService` downloads option contracts from public endpoints `api.kite.trade/instruments/{NFO,BFO}` — no auth required. Filters to CE/PE for the 5 supported underlyings. Instruments have a `Weekly` flag (true = not last Thursday of month).
- **OAuth flow**: `GET /api/zerodha/auth-url?apiKey={key}` → Kite Connect login → callback with `request_token` → `POST /api/zerodha/access-token` exchanges token and persists to `BrokerCredentials` DB table.
- **Position token format**: trading symbol string (e.g. `NIFTY2641320700PE`) — same as `tradingsymbol` from Kite Connect. `ZerodhaHttpClient.MapPosition` sets `InstrumentToken = p.TradingSymbol`, so the trading symbol serves as the canonical Zerodha position identity throughout the stack. Product codes mapped to unified values in `ZerodhaHttpClient.MapProduct`: MIS → `"I"` (intraday), CNC → `"D"` (delivery), NRML → `"NRML"` (preserved so `PositionMapper.ParseProduct` maps it to `ProductType.Delivery` and `ZerodhaPositionService.MapProductBack` sends `"NRML"` back to Kite on exit — not `"CNC"`).
- **Broker streaming is stubbed** — `KiteTickerStreamer` (implements `IMarketDataStreamer`) and `ZerodhaPortfolioStreamer` (implements `IPortfolioStreamer`) log a warning and never fire events. However, **LTP is live** for both the frontend (`PositionsHub` subscribes Zerodha instruments to the shared Upstox feed) and the risk engine (Worker's `CrossBrokerTokenMapper` converts Zerodha tokens to Upstox feed tokens). Portfolio-event-driven risk evaluation (instant fill detection) is unavailable until Kite postback webhooks are implemented.
- **`ZerodhaOptionContractProvider`** (`Options/`) — implements `IOptionContractProvider`; fetches option contracts via `ZerodhaClient.GetOptionContractsAsync` and maps to `Contracts.Options.IndexContracts`. `ZerodhaToken` is set to `TradingSymbol` (e.g. `"NIFTY2641320700PE"`) — not the numeric `instrument_token` — so it can be used directly for Zerodha order placement.
- **`ZerodhaTokenMappingProvider`** (`Options/`) — implements `ITokenMappingProvider`; returns `NativeContractKey` list (Segment + ExchangeToken + TradingSymbol) for all CE/PE contracts from the Kite CSV. `TradingSymbol` is both the native key and the order placement symbol. Used by `CrossBrokerTokenMapper` in the Worker.

### Risk Engine (`KAITerminal.RiskEngine`)

A library; consumed by Worker and Console via `services.AddRiskEngine<TTokenSource>(configuration)`.

**Background worker:** `StreamingRiskWorker` — polling + shared market-data driven; evaluates risk per user in parallel. Uses `IBrokerClientFactory` to create the right broker client per user based on `UserConfig.BrokerType`. LTP-triggered evaluations are rate-limited via `LtpEvalMinIntervalMs` (default 15 s). Calls `ITokenMapper.EnsureReadyAsync(user.BrokerType, ct)` before subscribing — for Upstox this is a no-op; for Zerodha it triggers `CrossBrokerTokenMapper` to download the Kite CSVs and build the feed-token mapping. **Note:** Zerodha portfolio streaming (fills/position changes) is still stubbed — only LTP-driven evaluation works for Zerodha.

**`RiskEvaluator` checks (in order)** — thresholds read from `UserConfig` (per-user, from DB):
1. MTM stop loss (`MtmSl`) → exit all
2. MTM profit target (`MtmTarget`) → exit all
3. Trailing SL (`TrailingEnabled: true`):
   - Activates when MTM ≥ `TrailingActivateAt`
   - Stop locks at `LockProfitAt` — a fixed floor, not relative to MTM at activation
   - Raised by `IncreaseTrailingBy` every time MTM gains `WhenProfitIncreasesBy` from last step
   - Fires (exit all) when MTM falls to or below the trailing stop

**State:** `InMemoryRiskRepository` (`ConcurrentDictionary<string, UserRiskState>`) holds trailing SL state and squared-off flag per `userId`. State resets on host restart.

**Log format** — all risk engine logs use `{UserId} ({Broker})` as a leading prefix and format monetary values as `₹+#,##0` / `₹-#,##0` with commas. Examples:

| Event | Level | Sample |
|---|---|---|
| Heartbeat (TSL active) | Info | `user@email (upstox)  PnL ₹+11,353  \|  Target ₹+25,000  \|  TSL ₹+3,025` |
| Heartbeat (TSL inactive) | Info | `user@email (upstox)  PnL ₹+11,353  \|  SL ₹-5,000  \|  Target ₹+25,000  \|  TSL off — activates at ₹+15,000` |
| Hard SL hit | Warn | `HARD SL HIT — user@email (upstox)  PnL ₹-5,000  ≤  SL ₹-5,000 — exiting all` |
| Target hit | Info | `TARGET HIT — user@email (upstox)  PnL ₹+25,000  ≥  Target ₹+25,000 — exiting all` |
| TSL activated | Info | `TSL ACTIVATED — user@email (upstox)  floor locked at ₹+3,025` |
| TSL raised | Info | `TSL RAISED — user@email (upstox)  floor → ₹+5,025` |
| TSL hit | Warn | `TSL HIT — user@email (upstox)  PnL ₹+3,000  ≤  floor ₹+3,025 — exiting all` |
| Square-off done | Warn | `Square-off complete — user@email (upstox) — all positions exited` |
| Square-off failed | Error | `Square-off FAILED — user@email (upstox) — marked as squared-off; manual verification required` |
| Streams live (no open positions) | Info | `Streams live — user@email (upstox)  watching 0 open instrument(s)` |
| Streams live (open positions) | Info | `Streams live — user@email (upstox)  watching 5 open instrument(s)` → also fires `SessionStarted` notification |
| Session crash/restart | Warn | `Restarting session — user@email (upstox) in 30s` |
| Market open/closed | Info | `Market open — risk engine active (09:15–15:30 India Standard Time)` |

**`IRiskEventNotifier`** — injected into `RiskEvaluator`; fires `NotifyAsync` at every risk trigger. `NullRiskEventNotifier` (no-op) is registered via `TryAddSingleton` in `AddRiskEngine` — hosts override it before calling `AddRiskEngine`. Worker registers `HttpRiskEventNotifier`; Api registers `SignalRRiskEventNotifier`.

**`IUserTokenSource`** (async) decouples user/token supply from the engine:
- `DbUserTokenSource` (Worker) — queries `UserRiskConfigs WHERE Enabled=true` joined with `BrokerCredentials` on every tick; auto-picks up DB changes without restart
- `SingleUserTokenSource` (Console) — reads `Upstox:AccessToken` from config

### Worker Token Mapping (`KAITerminal.Worker/Mapping/`)

**`CrossBrokerTokenMapper`** — registered as `ITokenMapper` singleton in the Worker; translates Zerodha numeric instrument tokens to/from Upstox market-data feed tokens so the shared Upstox WebSocket can price Zerodha positions.

**Design**: `(exchange, exchange_token)` is the universal cross-broker identifier. Both brokers use the same `exchange_token` for the same instrument. Upstox feed token format is exactly `"{prefix}|{exchange_token}"`. So mapping is **zero Upstox API calls** — only 2 public Kite CSV downloads (NFO + BFO) per day.

- `EnsureReadyAsync(brokerType, ct)` — skips entirely for Upstox (tokens already in feed format); for Zerodha downloads the Kite CSV via `ITokenMappingProvider.GetNativeContractKeysAsync`, builds bidirectional maps, caches until IST midnight.
- Segment → prefix: `"NFO-OPT"/"NFO-FUT"` → `"NSE_FO"`, `"BFO-OPT"/"BFO-FUT"` → `"BSE_FO"`.
- `ToFeedTokens(brokerType, nativeTokens)` — Upstox: identity. Zerodha: `tradingSymbol → NSE_FO|{exchangeToken}`.
- `ToNativeToken(brokerType, feedToken)` — reverse direction; returns trading symbol for Zerodha.
- **No analytics token required** — previously the mapper needed an Upstox analytics token to fetch 5 contract lists. That dependency is gone.

### API Data Storage

PostgreSQL via Neon — connection string set in `ConnectionStrings:DefaultConnection`. `AppDbContext` (in `KAITerminal.Infrastructure`) manages these tables (created automatically via `EnsureCreatedAsync()` on first startup — new tables require manual `ALTER TABLE` / `CREATE TABLE` on Neon):

| Table | Purpose |
|---|---|
| `BrokerCredentials` | Per-user broker credentials — `BrokerName` (`"upstox"` / `"zerodha"`), `ApiKey`, `ApiSecret`, `AccessToken`. Unique index on `(Username, BrokerName)`. |
| `UserTradingSettings` | Per-user trading preferences (underlying, expiry, etc.) |
| `AppUsers` | User registry — `Email`, `Name`, `IsActive`, `IsAdmin`, `CreatedAt` |
| `UserRiskConfigs` | Per-user PP/risk config — `BrokerType`, `Enabled`, `MtmTarget`, `MtmSl`, trailing SL fields. Unique index on `(Username, BrokerType)` — one PP config per user per broker. |

Option contracts are **not** stored in the DB. `MasterDataService` (singleton) uses `IMemoryCache` — cache key `"contracts:{broker}:{date}"`, expires at **8:15 AM IST** daily (pre-market refresh before the 9:15 open). On API restart contracts are re-fetched from the broker on the first request. `MasterDataService` injects `IEnumerable<IOptionContractProvider>` — it is fully broker-agnostic and supports N brokers without modification. **Multi-broker merge**: when both Upstox and Zerodha results are present, `MergeAll` joins on `ExchangeToken` (the universal cross-broker identifier — same value for the same instrument across all brokers, unique within one index). This fills both `UpstoxToken` and `ZerodhaToken` on each `ContractEntry`.

Services: `BrokerCredentialService`, `UserService` (`IUserService`), `RiskConfigService` (`IRiskConfigService`) — all scoped, registered via `AddDatabase()`.

### Frontend (`frontend/src`)

- Routing: React Router v7; routes in `App.tsx`. Non-auth pages wrapped in `ProtectedRoute`. `/auth/inactive` is public — shown to users pending activation.
- State: Zustand stores in `stores/` persisted to `localStorage` (`kai-terminal-auth`, `kai-terminal-brokers`). Logout clears all stores and calls `localStorage.clear()`. **PP store is not persisted** — loaded from `GET /api/risk-config` on mount via `useRiskConfig` hook.
- **Broker store** (`stores/broker-store.ts`) — persisted to `localStorage` under `"kai-terminal-brokers"`. Keyed by broker ID (`"upstox"` / `"zerodha"`); each entry holds `apiKey`, `apiSecret`, `redirectUrl`, and optional `accessToken`. `isConnected(id)` checks credentials exist; `isAuthenticated(id)` checks that a non-expired access token is also present.
- **Broker connect flow**: Settings → broker card → `ConnectBrokerDialog` saves API key + secret → "Authenticate" redirects to broker OAuth → callback lands on `/broker-redirect/:brokerId` → `BrokerRedirectPage` exchanges the code/request_token, persists token to DB, prefetches master contracts, then navigates to `/terminal`.
- All backend HTTP calls go through `services/broker-api.ts`; reads `VITE_API_URL` (default `https://localhost:5001`). Trading-specific calls (positions with exchange filter) go through `services/trading-api.ts`.
- Live positions use `@microsoft/signalr` — `PositionsPanel` connects to `WSS /hubs/positions?upstoxToken=...&exchange=NFO,BFO[&zerodhaToken=...&zerodhaApiKey=...]` on mount (`use-positions-feed.ts`), handles `ReceivePositions` (Upstox full refresh), `ReceiveLtpBatch` (in-place LTP + P&L update for both brokers), and `ReceiveOrderUpdate` (toast notification + Orders panel refresh). Shows a live `Wifi`/`WifiOff` indicator. Zerodha positions are fetched via REST on connect and merged; live LTP arrives via `ReceiveLtpBatch` using native Zerodha `instrumentToken` (backend maps feed tokens back before pushing).
- UI: shadcn/ui components; add new ones with `npx shadcn add <component>`.
- **Always use shadcn components over native HTML equivalents** — e.g. `Checkbox` instead of `<input type="checkbox">`. shadcn `Checkbox` supports `checked="indeterminate"` natively (no `ref` hack). `onCheckedChange` receives `CheckedState` (`boolean | "indeterminate"`).
- **Auth / session management:**
  - `lib/logout.ts` — `performLogout()` is the single source of truth for logout. Clears all Zustand stores, `localStorage`, and redirects to `/login`. Use this everywhere instead of duplicating store-clearing logic.
  - `ProtectedRoute` checks JWT expiry on every render — if expired, calls `performLogout()`. Also checks `isActive` claim — if false, redirects to `/auth/inactive`.
  - `api-client.ts` request interceptor calls `isTokenExpired` before attaching the `Authorization` header — aborts the request if expired.
  - `api-client.ts` response interceptor catches `401` responses mid-session and calls `performLogout()` automatically.
  - `auth-store.ts` stores `isActive` and `isAdmin` decoded from JWT claims.
- **Error boundary** — `components/error-boundary.tsx` wraps the entire app in `main.tsx`. Catches unexpected React crashes and renders a recovery screen with reload + recover options.
- **Env validation** — `lib/constants.ts` checks `VITE_API_URL` on module load and logs a clear error to the console if missing.
- **Supported indices** — NIFTY, SENSEX, BANKNIFTY, FINNIFTY, BANKEX (in that order). Enforced in `UNDERLYING_KEYS` (`lib/shift-config.ts`) and `UserTradingSettings`. Upstox instrument keys: `NSE_INDEX|Nifty 50`, `BSE_INDEX|SENSEX`, `NSE_INDEX|Nifty Bank`, `NSE_INDEX|Nifty Fin Service`, `BSE_INDEX|BANKEX` — note BANKEX uses `BSE_INDEX|BANKEX` (all-caps, no "BSE-" prefix).
- **Index ticker** — shows any of the 5 indices; defaults to NIFTY + SENSEX. A `SlidersHorizontal` popover lets the user toggle which indices are shown; selection is persisted to `localStorage`. Each card shows LTP + net change on the left and O/H/L as a vertical list on the right separated by a subtle border.
- **Dashboard page** (`/dashboard`) — live at-a-glance view: Row 1: 2 stat cards (Today's MTM with flash, Open Positions count). Row 2: 5 index cards with O/H/L mini-columns. Row 3: open positions mini-table + Day Extremes card + Profit Protection status card. All data from `usePositionsFeed`, `useIndicesFeed`, and `localStorage` — no new backend calls.
- **Quick Trade** — amber (`bg-amber-500`) button in the header (visible when any broker is authenticated). Has two tabs:
  - **By Price** — premium input, Buy/Sell toggle, CE/PE/Both action buttons with context-aware icons (`TrendingUp`/`TrendingDown`/`ArrowUpDown`). Expiry list from `GET /api/masterdata/contracts` (unified, broker-agnostic). Formatted as `TUE, 17th MAR 2026`. Order placement via Upstox only.
  - **By Chain** — Straddle/Strangle strategy toggle. Fetches live chain via `GET /api/upstox/options/chain`, auto-scrolls to ATM row. Straddle: CE+PE at same strike. Strangle: symmetric OTM pairs widening from ATM. Shows live required margin (debounced 600ms) via `POST /api/upstox/margin`. Dialog widens to `max-w-2xl` on chain tab. **Upstox-only.**
- **Position row actions** — three-dot menu on each row opens contextual dialogs: Exit Position (qty + Limit/Market toggle + limit price), Sell/Buy More (same layout, adapts to direction), Convert Position (Intraday↔Delivery, qty input). All dialogs show a symbol chip with contract name, LTP, expiry, qty.
- **Keyboard shortcuts** — `Q` Quick Trade, `R` Refresh, `E` Exit All (with confirm), `?` opens help popover in stats bar. Help popover implemented in `components/terminal/keyboard-shortcuts-help.tsx`.
- **Option contracts** — `GET /api/masterdata/contracts` is the unified broker-agnostic endpoint. Returns merged `ContractEntry` records: `upstoxToken = "NSE_FO|885247"` (feed token for subscriptions/chain), `zerodhaToken = "NIFTY2641320700PE"` (trading symbol for Zerodha order placement), `exchangeToken = "885247"` (universal join key). Populated based on which broker tokens are present in the request headers. The store key is the index name (e.g. `"NIFTY"`) — no broker prefix. `getByInstrumentKey(instrumentToken, tradingSymbol?)` in `option-contracts-store.ts` matches Upstox positions on `upstoxToken` and Zerodha positions on `zerodhaToken === tradingSymbol`.
- **AI Signals page** (`/ai-signals`) — `GET /api/ai/market-sentiment` assembles a market snapshot (index quotes, NIFTY+BANKNIFTY option chains, last 30 × 1-min NIFTY candles) and fans out to GPT-4o, Grok, Gemini, Claude in parallel (30s timeout each). Each model returns direction / confidence / reasons / support / resistance / watch_for as JSON. Frontend polls every 15 minutes with a countdown timer; manual refresh button. Page shows a `MarketContextBar` and 4 `SentimentCard` components. API keys configured via `AiSentiment` config section; add with `dotnet user-secrets`. Requires `X-Upstox-Access-Token` header (same as other Upstox endpoints, but endpoint is at `/api/ai/` so the token context is set manually inside the handler).
- **Profit Protection** — config is DB-backed. `useRiskConfig` hook loads from `GET /api/risk-config` on mount and saves via `PUT /api/risk-config`. The PP toggle uses an optimistic update (flips instantly, API call in background, reverts on failure). `useProfitProtection` hook is **display-only** — computes `currentSl` for the stats bar from live positions feed; exit orders are fired by the backend Worker, not the frontend. PP store (`profit-protection-store.ts`) is not persisted to localStorage.
- **Profit Protection env defaults** — PP store initial defaults can be overridden via `frontend/.env` variables: `VITE_PP_MTM_TARGET`, `VITE_PP_MTM_SL`, `VITE_PP_TRAILING_ENABLED`, `VITE_PP_TRAILING_ACTIVATE_AT`, `VITE_PP_LOCK_PROFIT_AT`, `VITE_PP_INCREASE_BY`, `VITE_PP_TRAIL_BY`. These are only used before the API config loads.
- **Risk event feed** — `useRiskFeed` hook (`hooks/use-risk-feed.ts`) connects to `WSS /hubs/risk` with JWT `accessTokenFactory`. Mounted app-wide via `RiskFeedMount` in `App.tsx` (wraps `ProtectedRoute` outlet). Listens for `ReceiveRiskEvent` and shows `sonner` toasts: red for `HardSlHit`/`TslHit`/`SquareOffFailed`, green for `TargetHit`/`SquareOffComplete`, blue info for `SessionStarted`/`TslActivated`/`TslRaised`. Frontend types: `RiskNotificationType` union + `RiskEvent` interface (includes `openPositionCount`) in `types/index.ts`.

---

## Configuration Reference

| File | Purpose |
|---|---|
| `backend/KAITerminal.Api/appsettings.json` | `Jwt:*`, `GoogleAuth:*`, `Frontend:Url`, `Upstox:ApiBaseUrl/HftBaseUrl`, `ConnectionStrings:DefaultConnection`, `AiSentiment:*`, `ApplicationInsights:ConnectionString` |
| `backend/KAITerminal.Worker/appsettings.json` | `Upstox:*`, `RiskEngine:*`, `Api:BaseUrl`, `Api:InternalKey`, `ConnectionStrings:DefaultConnection`, `ApplicationInsights:ConnectionString` |
| `backend/KAITerminal.Console/appsettings.json` | `Upstox:AccessToken`, `RiskEngine:*`, `ApplicationInsights:ConnectionString` |
| `frontend/.env` | `VITE_API_URL` (optional), `VITE_PP_MTM_TARGET`, `VITE_PP_MTM_SL`, and other PP defaults |

Store real tokens with `dotnet user-secrets` instead of committing them to `appsettings.json`:

```bash
cd backend/KAITerminal.Api
dotnet user-secrets set "Jwt:Key" "<secret>"
dotnet user-secrets set "GoogleAuth:ClientId" "<id>"
dotnet user-secrets set "GoogleAuth:ClientSecret" "<secret>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"

cd ../KAITerminal.Console
dotnet user-secrets set "Upstox:AccessToken" "<daily_token>"

cd ../KAITerminal.Worker
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"

# Risk event notifications — must match in both Api and Worker
cd ../KAITerminal.Api
dotnet user-secrets set "Api:InternalKey" "<uuid>"

cd ../KAITerminal.Worker
dotnet user-secrets set "Api:InternalKey" "<same-uuid>"
dotnet user-secrets set "Api:BaseUrl" "https://localhost:5001"

# AI Signals (KAITerminal.Api)
cd ../KAITerminal.Api
dotnet user-secrets set "AiSentiment:OpenAiApiKey"  "sk-..."
dotnet user-secrets set "AiSentiment:GrokApiKey"    "xai-..."
dotnet user-secrets set "AiSentiment:GeminiApiKey"  "AIza..."
dotnet user-secrets set "AiSentiment:ClaudeApiKey"  "sk-ant-..."

# Azure Application Insights — set in each project that sends telemetry
cd ../KAITerminal.Api
dotnet user-secrets set "ApplicationInsights:ConnectionString" "InstrumentationKey=...;IngestionEndpoint=..."

cd ../KAITerminal.Worker
dotnet user-secrets set "ApplicationInsights:ConnectionString" "InstrumentationKey=...;IngestionEndpoint=..."

cd ../KAITerminal.Console
dotnet user-secrets set "ApplicationInsights:ConnectionString" "InstrumentationKey=...;IngestionEndpoint=..."
```

App Insights is **optional** — if `ConnectionString` is empty the SDK is a no-op and all logs go to console only. See `docs/logging.md` for the full log level configuration and troubleshooting guide.

---

## User Trading Profile

This terminal is built **primarily for options sellers** (short options traders). All UI decisions must reflect a seller's perspective:

- **PE = green** — seller profits if market stays above strike (bullish for seller)
- **CE = red** — seller profits if market stays below strike (bearish for seller)
- Colour coding, icons, labels, and feature suggestions should always be from the **seller's point of view**, not the buyer's

---

## Git Workflow

**Never run any git operation without explicit user instruction.**

- Do not run `git add`, `git commit`, `git push`, or any other git command unless the user explicitly asks.
- When the user says "commit", propose the list of files to stage and the commit message first — do not execute until they confirm.
- Do not suggest committing after completing changes. Stop at the code, wait for the user.

---

## React Component Philosophy

- **Small, focused components** — every component should do one thing. If a component is growing large, extract logical pieces into their own files.
- **One component per file** — each file exports a single primary component. Helper sub-components used only within that file are the only exception.
- **Readable over clever** — code should be immediately understandable. A new developer (or Claude in a future session) should grasp what a component does in under 10 seconds.
- **Co-locate by feature** — related components live together (e.g. `panels/positions-panel/position-row.tsx`, `terminal/session-timer.tsx`). Don't dump everything in one folder.
- **Custom hooks for logic** — extract `useEffect`-heavy or reusable logic into a `use*.ts` hook file alongside the component.
- **No inline logic in JSX** — complex expressions belong in a variable or helper function above the return statement, not inside JSX.

---

## UI Design Standard

All frontend UI must be **modern, classy, and beautiful**. This is a non-negotiable requirement for every component, panel, and page. When building or modifying UI:

- Prefer polished shadcn/ui components over native HTML elements
- Use refined spacing, subtle borders (`border-border/40`), and layered backgrounds (`bg-muted/20`, `bg-muted/30`)
- Favour elegant typography: clear hierarchy, muted secondary text, tabular numerals for data
- Use purposeful colour — green/red for P&L, muted for inactive/secondary, primary for interactive focus
- Avoid visual clutter; every element should earn its place
- Animations and transitions should feel smooth and intentional, not jarring
- The overall aesthetic should feel like a premium financial terminal
- **Keep the default shadcn rounded corners** — do not switch to sharp/square corners
