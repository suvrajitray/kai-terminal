# KAITerminal.Api

ASP.NET Core Minimal API that serves as the backend for the KAI Terminal trading frontend. It handles Google OAuth authentication, issues JWTs, proxies all Upstox broker calls, and stores per-user broker credentials in PostgreSQL (Neon).

---

## Table of Contents

1. [Running](#running)
2. [Configuration](#configuration)
3. [Authentication](#authentication)
4. [Upstox Token Middleware](#upstox-token-middleware)
5. [Endpoints](#endpoints)
   - [Auth](#auth)
   - [Upstox — Auth](#upstox--auth)
   - [Upstox — Positions](#upstox--positions)
   - [Upstox — Orders](#upstox--orders)
   - [Upstox — Options](#upstox--options)
   - [Broker Credentials](#broker-credentials)
   - [Diagnostics](#diagnostics)

---

## Running

```bash
cd backend
dotnet run --project KAITerminal.Api   # HTTPS on :5001
dotnet watch --project KAITerminal.Api # hot-reload
```

---

## Configuration

Required keys — set via `appsettings.json` or `dotnet user-secrets`:

```bash
dotnet user-secrets set "Jwt:Key" "<min-32-char-secret>"
dotnet user-secrets set "GoogleAuth:ClientId" "<google-client-id>"
dotnet user-secrets set "GoogleAuth:ClientSecret" "<google-client-secret>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"
```

Full `appsettings.json` reference:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": ""
  },
  "Jwt": {
    "Key": "",
    "Issuer": "KAITerminal",
    "Audience": "KAITerminal"
  },
  "GoogleAuth": {
    "ClientId": "",
    "ClientSecret": ""
  },
  "Frontend": {
    "Url": "http://localhost:3000"
  },
  "Upstox": {
    "AutoReconnect": false
  }
}
```

`Frontend:Url` controls both the CORS allowed origin and the OAuth redirect target after login.

---

## Authentication

The API uses Google OAuth 2.0 to authenticate users and issues a short-lived JWT for subsequent requests.

**Flow:**

```
Browser → GET /auth/google
        → Google login page
        → GET /auth/google/callback  (Google redirects here)
        → GET {Frontend:Url}/auth/callback?token=<jwt>  (API redirects to frontend)
```

All endpoints except `/auth/google` and `/auth/google/callback` require `Authorization: Bearer <jwt>`.

---

## Upstox Token Middleware

All `/api/upstox/*` routes are covered by a `UseWhen` middleware that reads the Upstox access token from the `X-Upstox-AccessToken` request header and sets it as the ambient `UpstoxTokenContext` for the duration of the request. Individual endpoints need no token handling.

```csharp
app.UseWhen(
    ctx => ctx.Request.Path.StartsWithSegments("/api/upstox"),
    upstox => upstox.Use(async (ctx, next) =>
    {
        var token = ctx.Request.Headers["X-Upstox-AccessToken"].FirstOrDefault();
        using (UpstoxTokenContext.Use(token))
            await next(ctx);
    }));
```

---

## Endpoints

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/auth/google` | — | Redirect to Google OAuth login |
| `GET` | `/auth/google/callback` | — | OAuth callback; issues JWT, redirects to frontend |
| `GET` | `/api/profile` | JWT | Returns `{ name, email }` from JWT claims |

---

### Upstox — Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/upstox/access-token` | JWT | Exchange OAuth code for Upstox access token |

**Request body:**
```json
{
  "ApiKey": "string",
  "ApiSecret": "string",
  "RedirectUri": "http://localhost:3000/redirect/upstox",
  "Code": "string"
}
```

**Response:** `{ "AccessToken": "string" }`

---

### Upstox — Positions

All endpoints require `Authorization: Bearer <jwt>` and `X-Upstox-AccessToken` header.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/upstox/positions` | All positions for the day |
| `GET` | `/api/upstox/mtm` | Total MTM P&L `{ "Mtm": decimal }` |
| `POST` | `/api/upstox/positions/exit-all` | Exit all open positions |
| `POST` | `/api/upstox/positions/{instrumentToken}/exit` | Exit a single position |

`exit-all` and `exit/{token}` accept optional query parameters:
- `orderType`: `Market` (default) \| `Limit` \| `SL` \| `SLM`
- `product`: `Intraday` (default) \| `Delivery` \| `MTF` \| `CoverOrder`

---

### Upstox — Orders

All endpoints require `Authorization: Bearer <jwt>` and `X-Upstox-AccessToken` header.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/upstox/orders` | All orders for the day |
| `POST` | `/api/upstox/orders` | Place order (v2, returns `{ OrderId }`) |
| `POST` | `/api/upstox/orders/v3` | Place order (HFT v3, returns `{ OrderIds[], Latency }`) |
| `POST` | `/api/upstox/orders/cancel-all` | Cancel all pending orders |
| `DELETE` | `/api/upstox/orders/{orderId}` | Cancel a specific order |
| `DELETE` | `/api/upstox/orders/{orderId}/v3` | Cancel a specific order (HFT, returns latency) |

**Place order request body:**
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

---

### Upstox — Options

All endpoints require `Authorization: Bearer <jwt>` and `X-Upstox-AccessToken` header.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/upstox/options/chain` | Full option chain for a given expiry |
| `GET` | `/api/upstox/options/contracts` | Option contract metadata (no live prices) |
| `GET` | `/api/upstox/orders/by-option-price/resolve` | Resolve strike by target premium — no order placed |
| `POST` | `/api/upstox/orders/by-option-price` | Place order at strike nearest to target premium |
| `POST` | `/api/upstox/orders/by-option-price/v3` | Same, HFT v3 |
| `GET` | `/api/upstox/orders/by-strike/resolve` | Resolve strike by type (ATM/OTM/ITM) — no order placed |
| `POST` | `/api/upstox/orders/by-strike` | Place order at a named strike type |
| `POST` | `/api/upstox/orders/by-strike/v3` | Same, HFT v3 |

**Option chain query parameters:**
- `underlyingKey` — e.g. `NSE_INDEX|Nifty 50`
- `expiryDate` — `YYYY-MM-DD`

**Option contracts query parameters:**
- `underlyingKey` — required
- `expiryDate` — optional

**`GET /orders/by-option-price/resolve` query parameters** (returns `OptionChainEntry` for the matched strike — no order placed):
```
UnderlyingKey=NSE_INDEX|Nifty+50&ExpiryDate=2026-03-27&OptionType=CE
  &TargetPremium=150&PriceSearchMode=Nearest
```
`PriceSearchMode`: `Nearest` (default) | `GreaterThan` | `LessThan`

**`POST /orders/by-option-price` request body:**
```json
{
  "UnderlyingKey": "NSE_INDEX|Nifty 50",
  "ExpiryDate": "2026-03-27",
  "OptionType": "CE | PE",
  "TargetPremium": 150.0,
  "PriceSearchMode": "Nearest | GreaterThan | LessThan",
  "Quantity": 50,
  "TransactionType": "Buy | Sell",
  "OrderType": "Market",
  "Product": "Intraday"
}
```

**`GET /orders/by-strike/resolve` query parameters** (returns `OptionChainEntry` for the matched strike — no order placed):
```
UnderlyingKey=NSE_INDEX|Nifty+50&ExpiryDate=2026-03-27&OptionType=CE&StrikeType=OTM1
```
`StrikeType`: `ATM` | `OTM1`–`OTM5` | `ITM1`–`ITM5`

**`POST /orders/by-strike` request body:**
```json
{
  "UnderlyingKey": "NSE_INDEX|Nifty 50",
  "ExpiryDate": "2026-03-27",
  "OptionType": "CE | PE",
  "StrikeType": "ATM | OTM1..OTM5 | ITM1..ITM5",
  "Quantity": 50,
  "TransactionType": "Buy | Sell",
  "OrderType": "Market",
  "Product": "Intraday"
}
```

The `/resolve` variants return the resolved `PlaceOrderRequest` (including the instrument token and price) without placing the order — useful for previewing before committing.

---

### Broker Credentials

All endpoints require `Authorization: Bearer <jwt>`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/broker-credentials/` | List saved credentials for the authenticated user |
| `POST` | `/api/broker-credentials/` | Save or update credentials for a broker |
| `PUT` | `/api/broker-credentials/{brokerName}/access-token` | Update the access token for a broker |
| `DELETE` | `/api/broker-credentials/{brokerName}` | Delete credentials for a broker |

**Save request body:**
```json
{
  "BrokerName": "upstox",
  "ApiKey": "string",
  "ApiSecret": "string",
  "AccessToken": "string"
}
```
`AccessToken` is optional — omit or pass empty string and it will be stored as `"NA"`.

**Update access token request body:**
```json
{
  "AccessToken": "string"
}
```

Credentials are stored in PostgreSQL (Neon) and scoped to the authenticated user's email.

---

### Diagnostics

Available in `Development` environment only.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/debug/claims` | JWT | Lists all claims in the current JWT |
