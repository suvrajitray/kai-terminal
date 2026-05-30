# SEBI Order Agent — Design Spec

**Date:** 2026-05-28
**Branch:** `feature/sebi-order-agent`
**Status:** Implemented

---

## Problem

SEBI requires all broker API order placement to originate from a pre-registered static IP address
whitelisted against the user's broker account. KaiTerminal currently places all orders (manual
and automated) from the hosting server's single IP. When multiple unrelated users are onboarded,
their orders will be rejected because they will not come from their individually registered IPs.

Family members sharing an account may share one IP. All other users need their own dedicated
static IP. A user with both Upstox and Zerodha accounts can register the **same** static IP with
both brokers — SEBI's rule is per-user, not per-broker.

---

## Solution Overview

One lightweight `KAITerminal.OrderAgent` ASP.NET Core service **per user/family-group**, running
as a Docker container on the same server. Each container handles both Upstox and Zerodha orders.
Its outbound `HttpClient` binds to a specific static IP assigned to the host's network interface
via `SocketsHttpHandler.ConnectCallback`. The main Api, Worker, and RollingStraddle route all
order placement through the appropriate agent over loopback.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Server (one box)                    │
│                                                                 │
│  ┌──────────────────┐   ┌──────────────────┐                    │
│  │   KAI.Api        │   │   KAI.Worker     │                    │
│  │  (manual orders) │   │ (automated exits)│                    │
│  └────────┬─────────┘   └────────┬─────────┘                    │
│           └──────────┬───────────┘                              │
│                      │ IOrderRouter                             │
│                      │ checks IOrderAgentRegistry               │
│                      │                                          │
│           ┌──────────▼──────────────────────────────────────┐   │
│           │  agent or direct? (ConcurrentDictionary lookup) │   │
│           └──────────┬──────────────────────────────────────┘   │
│                      │ HTTP (loopback)                          │
│                      │ token in headers, order in body          │
│                      │                                          │
│  ┌───────────────────▼──┐   ┌──────────────────────┐            │
│  │ OrderAgent           │   │ OrderAgent           │  ...       │
│  │ alice                │   │ bob                  │            │
│  │ Upstox + Zerodha     │   │ Upstox + Zerodha     │            │
│  │ 127.0.0.1:5101       │   │ 127.0.0.1:5102       │            │
│  │ BIND_IP=1.2.3.101    │   │ BIND_IP=1.2.3.102    │            │
│  └──────────┬───────────┘   └──────────┬───────────┘            │
└─────────────┼─────────────────────────-┼──────────────────────-─┘
              │ TCP src=1.2.3.101         │ TCP src=1.2.3.102
              ▼                           ▼
    Upstox API + Zerodha API     Upstox API + Zerodha API
```

**Key properties:**
- One container per user — handles both Upstox and Zerodha, one static IP covers both brokers
- Agents listen on `127.0.0.1` only — never publicly reachable
- Tokens passed in request headers (consistent with main Api pattern); body contains only order data
- No `X-Agent-Key` auth — loopback-only binding is the security boundary (personal single-tenant VM)
- If no agent is registered for a user, Api and Worker fall back to direct broker calls
  (today's behaviour) — zero breaking change for existing accounts
- Agent URL resolved once per Worker session; ConcurrentDictionary lookup in Api (nanoseconds)
- Docker Compose `restart: unless-stopped` + `network_mode: host` — env vars and container config
  survive server reboots automatically; static IPs must be made permanent via netplan

---

## Order Placement Coverage

Every path that places broker orders is routed through the agent when one is registered:

| Component | Path | Mechanism |
|-----------|------|-----------|
| Api — manual orders | `POST /api/upstox/orders/v3`, cancel, cancel-all | `IOrderRouter` injected into endpoint |
| Api — by-price orders | `ByPriceOrderService` | `IOrderRouter` passed from endpoint |
| Api — position shift | `PositionShiftService` | `IOrderRouter` as required constructor param |
| Worker — risk engine exits | `RiskEvaluator.SquareOffAsync` → `broker.ExitPositionAsync/ExitAllPositionsAsync` | `OrderRoutingBrokerClient` decorator |
| Worker — auto-entry | `AutoEntryJob` | `IBrokerClientFactory.Create(..., username)` → decorator |
| Worker — auto-shift | `AutoShiftOrderExecutor` | same factory → same decorator |
| Rolling Straddle | `OrderExecutor.SellMarketAsync/BuyMarketAsync/CancelAllPendingAsync` | `IOrderRouter` injected directly |

---

## New Project: `KAITerminal.OrderAgent`

A minimal ASP.NET Core API. One Docker container per user/family-group, handling all brokers.

### Configuration

| Key | Example | Purpose |
|-----|---------|---------|
| `BIND_IP` | `1.2.3.101` | Outbound socket source IP — must be assigned to the host NIC |
| `ASPNETCORE_URLS` | `http://127.0.0.1:5101` | Listen address (loopback only — never public) |
| `ASPNETCORE_ENVIRONMENT` | `Production` | Standard ASP.NET environment |
| `Upstox__HftBaseUrl` | `https://api-hft.upstox.com` | HFT endpoint for Upstox place/cancel |
| `Upstox__ApiBaseUrl` | `https://api.upstox.com` | Standard endpoint — needed by `GetAllOrdersAsync` inside cancel-all |
| `Zerodha__ApiBaseUrl` | `https://api.kite.trade` | Zerodha REST API base URL |

No `AGENT_KEY` — agents are loopback-only (`127.0.0.1`). Only processes on the same VM can reach them.

### IP Binding Mechanism

```csharp
var bindIp = IPAddress.Parse(config["BindIp"]!);
var handler = new SocketsHttpHandler
{
    ConnectCallback = async (ctx, ct) =>
    {
        var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        socket.Bind(new IPEndPoint(bindIp, 0));
        await socket.ConnectAsync(ctx.DnsEndPoint, ct);
        return new NetworkStream(socket, ownsSocket: true);
    }
};
// This handler is injected into both UpstoxHttpClient and ZerodhaHttpClient
```

### Endpoints

Six endpoints. Tokens always travel in headers — body contains only order data.

**Upstox endpoints:**

| Method | Path | Headers | Body | Returns |
|--------|------|---------|------|---------|
| `POST` | `/upstox/orders` | `X-Upstox-Access-Token` | `UpstoxOrderRequest` | `{ orderIds[], latency }` |
| `DELETE` | `/upstox/orders/{id}` | `X-Upstox-Access-Token` | — | `{ orderId, latency }` |
| `DELETE` | `/upstox/orders/cancel-all` | `X-Upstox-Access-Token` | — | `{ orderIds[] }` |

**Zerodha endpoints:**

| Method | Path | Headers | Body | Returns |
|--------|------|---------|------|---------|
| `POST` | `/zerodha/orders` | `X-Zerodha-Api-Key`, `X-Zerodha-Access-Token` | `ZerodhaOrderRequest` | `{ orderId }` |
| `DELETE` | `/zerodha/orders/{id}` | `X-Zerodha-Api-Key`, `X-Zerodha-Access-Token` | — | `{ orderId }` |
| `DELETE` | `/zerodha/orders/cancel-all` | `X-Zerodha-Api-Key`, `X-Zerodha-Access-Token` | — | `{ orderIds[] }` |

All Upstox order placement goes through the HFT endpoint (`UpstoxHftClient.PlaceOrderV3Async`).
The Api returns the full `{ orderIds[], latency }` to the frontend. The Worker's
`OrderRoutingBrokerClient` takes `string.Join(",", result.OrderIds)`.

### Token Flow

**Api path (manual orders):**
```
Browser → X-Upstox-Access-Token header
Api middleware → UpstoxTokenContext.Use(token)
UpstoxOrderEndpoints → reads UpstoxTokenContext.Current
OrderRouter → HttpOrderAgentClient → sets X-Upstox-Access-Token on loopback request
Agent → reads header → UpstoxTokenContext.Use(token) → calls UpstoxHftClient
```

**Worker path (automated orders):**
```
Session start → OrderRoutingBrokerClient stores _accessToken + _apiKey
RiskEvaluator → broker.PlaceOrderAsync(request)  OR  broker.ExitPositionAsync(token, product)
Decorator → OrderRouter.PlaceUpstoxOrderAsync(username, _accessToken, mappedRequest)
OrderRouter → HttpOrderAgentClient → sets X-Upstox-Access-Token on loopback request
Agent → same as above
```

---

## New Project: `KAITerminal.OrderRouting`

Shared library referenced by `KAITerminal.Api`, `KAITerminal.Worker`, `KAITerminal.RollingStraddle`,
and `KAITerminal.OrderAgent`.

### Contract Models

```csharp
// Body of POST /upstox/orders
public record UpstoxOrderRequest(
    string  InstrumentToken,
    int     Quantity,
    string  TransactionType,   // "BUY" / "SELL"
    string  OrderType,         // "MARKET" / "LIMIT"
    string  Product,           // "I" / "D" etc.
    string  Validity,
    decimal Price,
    decimal TriggerPrice,
    bool    Slice,
    string? Tag);

// Body of POST /zerodha/orders
public record ZerodhaOrderRequest(
    string   InstrumentToken,
    int      Quantity,
    string   TransactionType,
    string   Product,
    string   OrderType,
    decimal? Price,
    decimal? TriggerPrice,
    string?  Exchange,
    string?  Tag);
```

### `IOrderAgentRegistry`

```csharp
public interface IOrderAgentRegistry
{
    AgentRegistration? GetAgent(string username);   // returns null if not registered
    void Upsert(string username, string agentUrl);
    void Remove(string username);
    Task LoadAsync(CancellationToken ct = default);
}

public sealed record AgentRegistration(string Url);
```

Implementation (`OrderAgentRegistry`):
- Singleton — loads all `IsEnabled = true` rows into `ConcurrentDictionary<string, AgentRegistration>` at startup via `LoadAsync`
- `Upsert`/`Remove` update the in-memory dictionary; DB write done by the admin endpoint before calling these
- No TTL, no background refresh — mutations only via admin API

### `IOrderRouter`

```csharp
public interface IOrderRouter
{
    // Upstox — all placement via HFT
    Task<PlaceOrderV3Result> PlaceUpstoxOrderAsync(
        string username, string accessToken,
        PlaceOrderRequest request, CancellationToken ct = default);

    Task<(string OrderId, int Latency)> CancelUpstoxOrderAsync(
        string username, string accessToken,
        string orderId, CancellationToken ct = default);

    Task<IReadOnlyList<string>> CancelAllUpstoxOrdersAsync(
        string username, string accessToken,
        CancellationToken ct = default);

    // Zerodha
    Task<string> PlaceZerodhaOrderAsync(
        string username, string accessToken, string apiKey,
        BrokerOrderRequest request, CancellationToken ct = default);

    Task<string> CancelZerodhaOrderAsync(
        string username, string accessToken, string apiKey,
        string orderId, CancellationToken ct = default);

    Task<IReadOnlyList<string>> CancelAllZerodhaOrdersAsync(
        string username, string accessToken, string apiKey,
        CancellationToken ct = default);
}
```

`OrderRouter` implementation:
- Checks registry → if agent found, delegates to `HttpOrderAgentClient` (HTTP over loopback)
- If no agent → direct broker call via injected `UpstoxClient` / `ZerodhaClient?`
- `ZerodhaClient` is optional (`null` default) — Rolling Straddle is Upstox-only and passes none
- Hard fail if agent registered but HTTP call fails — does NOT silently fall back (would use wrong IP)

---

## DB Changes

### New Table: `UserOrderAgents`

```sql
CREATE TABLE "UserOrderAgents" (
    "Username"   VARCHAR NOT NULL PRIMARY KEY,
    "AgentUrl"   VARCHAR NOT NULL,
    "StaticIp"   VARCHAR NOT NULL,
    "IsEnabled"  BOOLEAN NOT NULL DEFAULT true
);
```

Manual `CREATE TABLE` on the server. One row per user — covers all brokers.

**Example rows:**

| Username | AgentUrl | StaticIp | IsEnabled |
|----------|----------|----------|-----------|
| alice@gmail.com | http://127.0.0.1:5101 | 1.2.3.101 | true |
| bob@gmail.com | http://127.0.0.1:5102 | 1.2.3.102 | true |

---

## Changes to `KAITerminal.Api`

### Admin Endpoints (`/api/admin/order-agents`)

Requires `IsAdmin` JWT claim.

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/order-agents` | — | List all registrations |
| `POST` | `/api/admin/order-agents` | `{ username, agentUrl, staticIp }` | Upsert — writes DB then updates registry |
| `DELETE` | `/api/admin/order-agents/{username}` | — | Remove from DB and registry |

POST upsert sets `IsEnabled = true` even if the row previously had `IsEnabled = false`.

### Order Endpoints

All six order endpoints (`UpstoxOrderEndpoints`, `ZerodhaOrderEndpoints`) inject `IOrderRouter`
and delegate placement/cancellation to it. Username from JWT (`user.GetEmail()`), tokens from
the ambient context (`UpstoxTokenContext.Current`, `ZerodhaTokenContext.Current`).

### `ByPriceOrderService`

Accepts `IOrderRouter` parameter. Routes the final placement call through the router.

### `PositionShiftService`

Accepts `IOrderRouter` as required parameter. All order placements go through the router.
`WaitForFillAsync` polls `GetAllOrdersAsync` — read-only, stays as direct broker call.

---

## Changes to `KAITerminal.Worker`

### `OrderRoutingBrokerClient` (new, `KAITerminal.Worker/OrderRouting/`)

Decorator over `IBrokerClient`. Stores `(username, brokerType, accessToken, apiKey)` at
construction time. Intercepts all order-mutating methods; delegates read-only methods.

**Intercepted methods:**
- `PlaceOrderAsync` → maps `BrokerOrderRequest` → `PlaceOrderRequest` for Upstox, or passes through for Zerodha; calls `IOrderRouter`
- `CancelOrderAsync` → `IOrderRouter`
- `CancelAllPendingOrdersAsync` → `IOrderRouter`
- `ExitPositionAsync` → fetches live positions from `_inner`, finds matching position, calls `this.PlaceOrderAsync` (which routes via `IOrderRouter`)
- `ExitAllPositionsAsync` → same: fetch, filter, exit shorts first then longs, all via `this.PlaceOrderAsync`

All read methods (`GetAllPositionsAsync`, `GetTotalMtmAsync`, `GetFundsAsync`, `GetAllOrdersAsync`) delegate to `_inner` unchanged.

### `OrderRoutingBrokerClientFactory` (new, `KAITerminal.Worker/OrderRouting/`)

Custom `IBrokerClientFactory` registered in Worker instead of `BrokerClientFactory`.
`Create(brokerType, accessToken, apiKey?, username?)`:
- Creates inner `UpstoxBrokerClient` or `ZerodhaBrokerClient`
- If `username != null` and `registry.GetAgent(username) != null` → wraps with `OrderRoutingBrokerClient`
- Otherwise → returns bare inner client (fallback, existing behaviour)

### `StreamingRiskWorker.cs`

One-line change: `_brokerFactory.Create(user.BrokerType, user.AccessToken, user.ApiKey, user.UserId)`.
The factory handles wrapping transparently.

### `AutoEntryJob.cs`

One-line change: same pattern — `config.Username` passed as 4th arg to `Create`.

---

## Changes to `KAITerminal.RollingStraddle`

`OrderExecutor` now injects `IOrderRouter` for writes, `IBrokerOrderService` for reads:
- `SellMarketAsync`, `BuyMarketAsync` → `IOrderRouter.PlaceUpstoxOrderAsync`
- `CancelAllPendingAsync` → `IOrderRouter.CancelAllUpstoxOrdersAsync`
- `WaitForFillAsync` → `IBrokerOrderService.GetAllOrdersAsync` (unchanged)

Username from `IOptions<StrategyConfig>`, access token from `IOptions<UpstoxConfig>`.
`Program.cs` registers the three `OrderRouting` singletons and calls `LoadAsync` before startup.
`AddDatabase` added so `OrderAgentRegistry.LoadAsync` can scope into `AppDbContext`.

---

## Docker + Deployment

See `docs/order-agent-deployment.md` for the full step-by-step deployment guide.

### `docker-compose.yml` template

```yaml
services:
  order-agent-<username>:
    image: kaiterminal/order-agent:latest
    network_mode: host
    restart: unless-stopped
    environment:
      ASPNETCORE_URLS: http://127.0.0.1:<PORT>
      BIND_IP: <STATIC_IP>
      ASPNETCORE_ENVIRONMENT: Production
      Upstox__HftBaseUrl: https://api-hft.upstox.com
      Upstox__ApiBaseUrl: https://api.upstox.com
      Zerodha__ApiBaseUrl: https://api.kite.trade
```

`restart: unless-stopped` + `network_mode: host` means:
- Container auto-restarts after server reboot
- Env vars are baked into the container config — they survive reboots without any `.env` file
- Static IPs assigned to the NIC must be made permanent via netplan (see deployment guide)

---

## Error Handling

**Agent unreachable:** `OrderRouter` surfaces the exception — does NOT silently fall back to direct
call (that would place the order from the wrong IP — SEBI violation). Agent has
`restart: unless-stopped` to auto-recover from crashes.

**No agent registered:** `GetAgent(username)` returns null → falls through to direct broker call —
identical to today's behaviour.

---

## Security

| Concern | Mitigation |
|---------|-----------|
| Agent exposed to internet | `ASPNETCORE_URLS` binds to `127.0.0.1` — loopback only |
| Unauthorized calls to agent | Loopback-only binding — only processes on the same VM can reach it |
| Token in loopback request | Never leaves the machine — acceptable |
| Agent crash affects other users | Isolated container per user, `restart: unless-stopped` |
| Static IP on wrong container | Each container has its own `BIND_IP` — misconfiguration surfaces immediately as broker auth failure |

---

## Updated Dependency Graph

```
KAITerminal.Contracts
    └── KAITerminal.Broker
        └── KAITerminal.Upstox / KAITerminal.Zerodha
            └── KAITerminal.OrderRouting
                ├── KAITerminal.Api
                ├── KAITerminal.Worker
                ├── KAITerminal.RollingStraddle
                └── KAITerminal.OrderAgent
```

---

## Files Changed Summary

| File | Type | Change |
|------|------|--------|
| `KAITerminal.OrderAgent/` | New project | Entire project |
| `KAITerminal.OrderRouting/` | New project | Entire project |
| `KAITerminal.Infrastructure/Data/UserOrderAgent.cs` | New file | DB entity |
| `KAITerminal.Infrastructure/Data/AppDbContext.cs` | Modified | Add `UserOrderAgents` DbSet |
| `KAITerminal.Api/KAITerminal.Api.csproj` | Modified | Add OrderRouting reference |
| `KAITerminal.Api/Program.cs` | Modified | Register OrderRouting services + LoadAsync |
| `KAITerminal.Api/Endpoints/UpstoxOrderEndpoints.cs` | Modified | Use `IOrderRouter` |
| `KAITerminal.Api/Endpoints/ZerodhaOrderEndpoints.cs` | Modified | Use `IOrderRouter` |
| `KAITerminal.Api/Endpoints/AdminOrderAgentEndpoints.cs` | New file | Admin CRUD |
| `KAITerminal.Api/Services/ByPriceOrderService.cs` | Modified | Use `IOrderRouter` |
| `KAITerminal.Api/Services/PositionShiftService.cs` | Modified | Use `IOrderRouter` |
| `KAITerminal.Worker/KAITerminal.Worker.csproj` | Modified | Add OrderRouting reference |
| `KAITerminal.Worker/Program.cs` | Modified | Register OrderRouting services + LoadAsync |
| `KAITerminal.Worker/OrderRouting/OrderRoutingBrokerClient.cs` | New file | IBrokerClient decorator |
| `KAITerminal.Worker/OrderRouting/OrderRoutingBrokerClientFactory.cs` | New file | Custom IBrokerClientFactory |
| `KAITerminal.Worker/Jobs/AutoEntryJob.cs` | Modified | Pass username to factory |
| `KAITerminal.RiskEngine/Workers/StreamingRiskWorker.cs` | Modified | Pass username to factory |
| `KAITerminal.Broker/IBrokerClientFactory.cs` | Modified | Add optional `username` param |
| `KAITerminal.Broker/BrokerClientFactory.cs` | Modified | Match updated interface |
| `KAITerminal.RollingStraddle/KAITerminal.RollingStraddle.csproj` | Modified | Add OrderRouting reference |
| `KAITerminal.RollingStraddle/Program.cs` | Modified | Register OrderRouting + AddDatabase + LoadAsync |
| `KAITerminal.RollingStraddle/Services/OrderExecutor.cs` | Modified | Use `IOrderRouter` for writes |
| `backend/docker-compose.yml` | New file | Per-user agent template |
| `backend/KAITerminal.OrderAgent/Dockerfile` | New file | Multi-stage .NET 10 build |
