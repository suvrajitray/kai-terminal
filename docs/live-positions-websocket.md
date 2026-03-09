# Live Positions via WebSocket

Real-time position data is delivered through a self-hosted ASP.NET Core SignalR hub backed by two Upstox WebSocket streams per connected client.

---

## Architecture

```
Frontend (React)
  │  @microsoft/signalr
  │  WSS /hubs/positions?upstoxToken=...
  ▼
PositionsHub  (ASP.NET Core SignalR)
  ├── UpstoxClient.GetAllPositionsAsync()   ← initial load + re-fetch on portfolio events
  ├── IPortfolioStreamer                     ← Upstox Portfolio Stream Feed V2 (JSON/WS)
  │     order_update / position_update  →  re-fetch positions → push ReceivePositions
  └── IMarketDataStreamer                    ← Upstox Market Data Feed V3 (protobuf/WS)
        LTP ticks  →  push ReceiveLtpBatch
```

Each browser connection gets its own pair of Upstox WebSocket connections. They are created in `OnConnectedAsync` and disposed in `OnDisconnectedAsync` via `PositionStreamManager`.

---

## Files Changed / Added

### Backend

| File | Change |
|------|--------|
| `KAITerminal.Api/Hubs/PositionsHub.cs` | **New** — SignalR hub, manages per-connection streamers |
| `KAITerminal.Api/Services/PositionStreamManager.cs` | **New** — singleton `ConcurrentDictionary` of streamer pairs keyed by connection ID |
| `KAITerminal.Api/Program.cs` | Added `AddSignalR()`, `AddSingleton<PositionStreamManager>()`, `MapHub<PositionsHub>("/hubs/positions")` |
| `KAITerminal.Auth/Extensions/AuthExtensions.cs` | Added `.AllowCredentials()` to CORS (required for SignalR negotiate) |

### Frontend

| File | Change |
|------|--------|
| `package.json` | Added `@microsoft/signalr@10.0.0` |
| `components/panels/positions-panel.tsx` | SignalR connection on mount; `ReceivePositions` replaces state; `ReceiveLtpBatch` updates `last_price` + recalculates `unrealised`/`pnl` in real-time; live `Wifi`/`WifiOff` indicator |

---

## Hub Protocol

### Connection

```
WSS https://<host>/hubs/positions?upstoxToken=<upstox_access_token>
```

The Upstox access token is passed as a query parameter. The hub aborts the connection if the token is missing.

### Server → Client messages

| Message | Payload | When sent |
|---------|---------|-----------|
| `ReceivePositions` | `Position[]` | On connect (initial load) and after every `order_update` or `position_update` from the Upstox portfolio stream |
| `ReceiveLtpBatch` | `Array<{ instrumentToken: string, ltp: number }>` | On every market data tick for subscribed instruments |

### Market data subscription

On connect, the hub subscribes the `MarketDataStreamer` to all **open** position instrument tokens in `Ltpc` mode (last traded price + close price — lightweight feed). After a `ReceivePositions` refresh, it re-subscribes to the updated instrument set automatically.

---

## Frontend Live P&L Calculation

When a `ReceiveLtpBatch` arrives, the panel recomputes `unrealised` and `pnl` locally without waiting for a REST round-trip:

```ts
const unrealised = position.quantity * (ltp - position.average_price);
const pnl = unrealised + position.realised;
```

`quantity` is already in units (negative for short positions), so this formula correctly yields a gain for shorts when the price falls.

Full P&L (including realised) is authoritative only after a `ReceivePositions` event from the portfolio stream (i.e. when an order is filled or a position closes).

---

## Hosting

### No Azure SignalR Service required

`Microsoft.AspNetCore.SignalR` is the open-source, **self-hosted** implementation built into ASP.NET Core. It runs on any server with no Microsoft cloud dependency. Azure SignalR Service is a separate paid product for very high-scale deployments (thousands of concurrent connections) and is not needed here.

---

### Azure App Service (Web Apps)

WebSockets are **disabled by default** on Azure App Service. Enable them before deploying:

**Portal:**
> Web App → Configuration → General settings → **Web sockets: On** → Save

**Azure CLI:**
```bash
az webapp config set \
  --name <app-name> \
  --resource-group <resource-group> \
  --web-sockets-enabled true
```

**Bicep / ARM:**
```bicep
resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  ...
  properties: {
    siteConfig: {
      webSocketsEnabled: true
    }
  }
}
```

#### Scaling out (multiple instances)

SignalR connection state (streamers) lives in memory on one server instance. If you scale to 2+ instances, a client must always be routed to the same instance — this is called **sticky sessions**.

Azure App Service has **ARR Affinity** enabled by default, which handles this automatically via a cookie. No code changes needed for up to ~5 instances.

If you ever need more than ~5 instances, switch to **Azure SignalR Service** (backplane mode) — the ASP.NET Core SDK supports it with a one-line change:

```csharp
// Program.cs
builder.Services.AddSignalR().AddAzureSignalR();
```

And set the connection string:
```bash
az webapp config appsettings set \
  --name <app-name> \
  --resource-group <resource-group> \
  --settings Azure__SignalR__ConnectionString="<connection_string>"
```

---

### Self-hosted (VPS / Docker)

No special configuration needed. Kestrel supports WebSockets natively.

#### Nginx reverse proxy

If you front Kestrel with Nginx, add the WebSocket upgrade headers to your location block:

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

#### Docker

No special flags needed. Just make sure port 5001 (or whichever port Kestrel listens on) is exposed in your `docker run` / `docker-compose` config.

---

### Environment variables / appsettings

No new configuration keys are required. The hub reuses the existing `UpstoxSdk` registration and `CORS:Frontend:Url` setting.

Make sure `Frontend:Url` in `appsettings.json` (or environment variables) matches the exact origin of the frontend, because the CORS policy is `WithOrigins(frontendUrl)` — a mismatch will block the SignalR negotiate request.
