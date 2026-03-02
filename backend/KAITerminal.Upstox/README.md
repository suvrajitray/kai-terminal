# KAITerminal.Upstox SDK

A .NET 10 class library that wraps the [Upstox REST API v2/v3](https://upstox.com/developer/api-documentation/) and the real-time WebSocket feeds into a clean, DI-friendly abstraction.

---

## Table of Contents

1. [Requirements](#requirements)
2. [Project Reference](#project-reference)
3. [Configuration](#configuration)
4. [Registration (DI)](#registration-di)
5. [Token Generation](#token-generation)
6. [Multi-User Token Handling](#multi-user-token-handling)
7. [REST Features](#rest-features)
   - [Positions](#1-positions)
   - [Orders](#2-orders)
   - [Option Chain & Contracts](#3-option-chain--contracts)
   - [Place Order by Option Price](#4-place-order-by-option-price)
   - [Place Order by Strike Type](#5-place-order-by-strike-type)
   - [Resolve Order Without Placing](#6-resolve-order-without-placing)
8. [WebSocket Streaming](#websocket-streaming)
   - [Market Data Feed V3](#market-data-feed-v3)
   - [Portfolio Stream Feed V2](#portfolio-stream-feed-v2)
9. [Error Handling](#error-handling)
10. [Models Reference](#models-reference)
11. [Enums Reference](#enums-reference)
12. [Usage in ASP.NET Core Minimal API](#usage-in-aspnet-core-minimal-api)
13. [Usage in .NET Worker Service](#usage-in-net-worker-service)
14. [Protobuf & Apple Silicon](#protobuf--apple-silicon)

---

## Requirements

- .NET 10
- Upstox developer account with a valid daily **access token**

---

## Project Reference

Add the project to your solution and reference it:

```xml
<!-- YourApp.csproj -->
<ItemGroup>
  <ProjectReference Include="..\KAITerminal.Upstox\KAITerminal.Upstox.csproj" />
</ItemGroup>
```

---

## Configuration

The SDK reads its settings from the `"Upstox"` section of `IConfiguration` (e.g. `appsettings.json`).

```json
{
  "Upstox": {
    "AccessToken": "your_daily_oauth_token",
    "ApiBaseUrl": "https://api.upstox.com",
    "HftBaseUrl": "https://api-hft.upstox.com",
    "HttpTimeout": "00:00:30",
    "AutoReconnect": true,
    "ReconnectIntervalSeconds": 3,
    "MaxReconnectAttempts": 5
  }
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `AccessToken` | `string?` | `null` | Daily OAuth2 token. Required for single-user (worker service) usage. Omit when using [`UpstoxTokenContext`](#multi-user-token-handling) to supply tokens per call. |
| `ApiBaseUrl` | `string` | `https://api.upstox.com` | Read-only REST API |
| `HftBaseUrl` | `string` | `https://api-hft.upstox.com` | HFT order-write API (v2 & v3) |
| `HttpTimeout` | `TimeSpan` | `00:00:30` | HTTP request timeout |
| `AutoReconnect` | `bool` | `true` | Automatically reconnect WebSocket on unexpected drop |
| `ReconnectIntervalSeconds` | `int` | `3` | Base delay; multiplied by attempt number (1×, 2×, 3× …) |
| `MaxReconnectAttempts` | `int` | `5` | Give up after this many consecutive failures |

You can also configure programmatically without `IConfiguration`:

```csharp
// Single-user / worker service — token in config
builder.Services.AddUpstoxSdk(cfg =>
{
    cfg.AccessToken = "your_token";
    cfg.AutoReconnect = false;
});

// Multi-user terminal — no token in config; tokens are supplied per call via UpstoxTokenContext
builder.Services.AddUpstoxSdk(cfg =>
{
    cfg.AutoReconnect = false;
});
```

---

## Registration (DI)

```csharp
// Program.cs
using KAITerminal.Upstox.Extensions;

builder.Services.AddUpstoxSdk(builder.Configuration);
```

This registers the following services:

| Service | Lifetime | Purpose |
|---|---|---|
| `UpstoxClient` | Singleton | High-level facade — the main entry point |
| `IAuthService` | Singleton | OAuth 2.0 token generation |
| `IPositionService` | Singleton | Position queries and exits |
| `IOrderService` | Singleton | Order placement and cancellation |
| `IOptionService` | Singleton | Option chain, contracts, and option-aware order placement |
| `IMarketDataStreamer` | Transient | One WebSocket market data connection per instance |
| `IPortfolioStreamer` | Transient | One WebSocket portfolio updates connection per instance |

> **Inject `UpstoxClient`** for convenience. Inject individual service interfaces only when you want to keep concerns separated.

---

## Token Generation

Upstox uses the **OAuth 2.0 authorization code flow** to issue daily access tokens. The SDK handles the token exchange (step 3) — you manage the browser redirect for step 1.

### Step 1 — Redirect the user to Upstox login

Build the authorization URL and open it in a browser or WebView:

```
https://api.upstox.com/v2/login/authorization/dialog
  ?response_type=code
  &client_id=YOUR_API_KEY
  &redirect_uri=YOUR_REDIRECT_URI
```

> You can find your API key and secret in the [Upstox developer console](https://developer.upstox.com/).

### Step 2 — Capture the authorization code

After the user authenticates and grants permission, Upstox redirects to your `redirect_uri` with a `code` query parameter:

```
https://your-app/callback?code=AUTH_CODE_HERE
```

### Step 3 — Exchange the code for an access token

```csharp
using KAITerminal.Upstox.Models.Responses;

TokenResponse token = await client.GenerateTokenAsync(
    clientId:          "your_api_key",
    clientSecret:      "your_api_secret",
    redirectUri:       "https://your-app/callback",
    authorizationCode: "code_from_oauth_redirect");

Console.WriteLine(token.AccessToken);
Console.WriteLine($"Logged in as: {token.UserName} ({token.Email})");
```

Store `token.AccessToken` and use it for all subsequent API calls — pass it via `UpstoxTokenContext.Use()` (multi-user) or set `UpstoxConfig.AccessToken` (single-user).

### ASP.NET Core — OAuth callback endpoint

```csharp
app.MapGet("/auth/callback", async (
    string code,
    UpstoxClient client,
    CancellationToken ct) =>
{
    var token = await client.GenerateTokenAsync(
        clientId:          "your_api_key",
        clientSecret:      "your_api_secret",
        redirectUri:       "https://your-app/auth/callback",
        authorizationCode: code,
        cancellationToken: ct);

    // Persist token.AccessToken for the user and redirect to your app
    return Results.Ok(new { accessToken = token.AccessToken, user = token.UserName });
});
```

### `TokenResponse` properties

| Property | Type | Description |
|---|---|---|
| `AccessToken` | `string` | Bearer token for all API calls |
| `ExtendedToken` | `string?` | Long-lived token (if issued by Upstox) |
| `TokenType` | `string` | Always `"Bearer"` |
| `Email` | `string?` | User email address |
| `UserId` | `string?` | Upstox user ID |
| `UserName` | `string?` | Display name |
| `UserType` | `string?` | e.g. `"individual"` |
| `Broker` | `string?` | Always `"UPSTOX"` |
| `IsActive` | `bool` | Whether the account is active |
| `Exchanges` | `IReadOnlyList<string>?` | Enabled exchanges (e.g. `["NSE", "BSE"]`) |
| `Products` | `IReadOnlyList<string>?` | Enabled products (e.g. `["I", "D"]`) |
| `OrderTypes` | `IReadOnlyList<string>?` | Enabled order types |

---

## Multi-User Token Handling

By default the SDK reads `AccessToken` from configuration — this is the right pattern for a **single-user worker service** where one token is fixed for the lifetime of the process.

For a **multi-user trading terminal** (e.g., an ASP.NET Core API serving many Upstox accounts), each API call must authenticate as a different user. Use `UpstoxTokenContext.Use()` to set a per-call token. It relies on `AsyncLocal<T>`, so the token flows correctly through every `await` in the call chain without changing any method signatures.

### Token priority

| Source | When used |
|---|---|
| `UpstoxTokenContext.Current` | Set via `UpstoxTokenContext.Use(token)` for the current async scope |
| `UpstoxConfig.AccessToken` | Fallback — the token from configuration |

### Basic usage

```csharp
using KAITerminal.Upstox;

// Wrap all SDK calls for a specific user inside a using block.
// The token is automatically injected into every HTTP request made within the scope.
using (UpstoxTokenContext.Use(currentUser.UpstoxToken))
{
    var positions = await upstoxClient.GetAllPositionsAsync();
    var orders    = await upstoxClient.GetAllOrdersAsync();
    var mtm       = await upstoxClient.GetTotalMtmAsync();
}
// Previous token (or none) is restored after the block exits.
```

### WebSocket streamers in a multi-user scenario

The token active when `ConnectAsync()` is called is captured and reused automatically for all subsequent auto-reconnects — no extra work required.

```csharp
using (UpstoxTokenContext.Use(currentUser.UpstoxToken))
{
    var streamer = upstoxClient.CreateMarketDataStreamer();
    await streamer.ConnectAsync(); // token captured here
    await streamer.SubscribeAsync(["NSE_INDEX|Nifty 50"], FeedMode.Ltpc);
}
// streamer remains active and reconnects with the captured token.
```

### ASP.NET Core — per-request middleware

The recommended pattern for a web API is to resolve the current user's token in middleware and set the context once per request:

```csharp
// Middleware that reads the Upstox token from a custom header or user store
app.Use(async (ctx, next) =>
{
    var token = ctx.Request.Headers["X-Upstox-Token"].FirstOrDefault()
                ?? await userStore.GetTokenAsync(ctx.User.Identity!.Name!);

    using (UpstoxTokenContext.Use(token))
        await next(ctx);
});

// Endpoints then call the SDK without knowing about tokens at all
app.MapGet("/positions", async (UpstoxClient client, CancellationToken ct) =>
    Results.Ok(await client.GetAllPositionsAsync(ct)));
```

---

## REST Features

All methods are `async`, accept a `CancellationToken`, and throw `UpstoxException` on API errors.

### 1. Positions

#### Get all positions

```csharp
IReadOnlyList<Position> positions = await client.GetAllPositionsAsync();

foreach (var p in positions)
{
    Console.WriteLine($"{p.TradingSymbol}  qty={p.Quantity}  pnl={p.Pnl:F2}");
}
```

#### Filter to open positions

```csharp
var open = positions.Where(p => p.IsOpen).ToList();
// IsOpen == true when Quantity != 0
```

#### Get total MTM (realised + unrealised P&L)

```csharp
decimal totalMtm = await client.GetTotalMtmAsync();
Console.WriteLine($"Total MTM: ₹{totalMtm:F2}");
```

#### Exit all open positions (concurrent)

```csharp
IReadOnlyList<string> orderIds = await client.ExitAllPositionsAsync(
    orderType: OrderType.Market,
    product:   Product.Intraday);
```

Positive quantity → SELL order; negative quantity → BUY order. All exit orders are placed concurrently with `Task.WhenAll`.

#### Exit a single position

```csharp
string orderId = await client.ExitPositionAsync(
    instrumentToken: "NSE_FO|52618",
    orderType:       OrderType.Market,
    product:         Product.Intraday);
```

---

### 2. Orders

#### Get all orders for the day

```csharp
IReadOnlyList<Order> orders = await client.GetAllOrdersAsync();

var pending = orders.Where(o => o.IsCancellable).ToList();
// IsCancellable == false when Status is "complete", "rejected", or "cancelled"
```

#### Cancel all pending orders

```csharp
IReadOnlyList<string> cancelledIds = await client.CancelAllPendingOrdersAsync();
```

#### Cancel a single order

```csharp
// v2
string orderId = await client.CancelOrderAsync("some-order-id");

// v3 HFT — also returns API latency
(string id, int latencyMs) = await client.CancelOrderV3Async("some-order-id");
```

#### Place an order — v2 (single order ID)

```csharp
var result = await client.PlaceOrderAsync(new PlaceOrderRequest
{
    InstrumentToken = "NSE_FO|52618",
    Quantity        = 50,
    TransactionType = TransactionType.Buy,
    OrderType       = OrderType.Market,
    Product         = Product.Intraday,
});

Console.WriteLine($"Order placed: {result.OrderId}");
```

#### Place an order — v3 HFT (supports auto-slice, returns latency)

```csharp
var result = await client.PlaceOrderV3Async(new PlaceOrderRequest
{
    InstrumentToken = "NSE_FO|52618",
    Quantity        = 900,
    TransactionType = TransactionType.Sell,
    OrderType       = OrderType.Market,
    Product         = Product.Intraday,
    Slice           = true,  // auto-split if qty > freeze limit
});

Console.WriteLine($"Order IDs: {string.Join(", ", result.OrderIds)}");
Console.WriteLine($"API latency: {result.Latency} ms");
```

#### Place a limit order with SL

```csharp
var result = await client.PlaceOrderAsync(new PlaceOrderRequest
{
    InstrumentToken = "NSE_FO|52618",
    Quantity        = 50,
    TransactionType = TransactionType.Buy,
    OrderType       = OrderType.SL,
    Price           = 210.00m,
    TriggerPrice    = 209.50m,
    Product         = Product.Intraday,
    Validity        = Validity.Day,
    Tag             = "SL_ENTRY",
});
```

---

### 3. Option Chain & Contracts

#### Full option chain (all strikes for an expiry)

```csharp
IReadOnlyList<OptionChainEntry> chain = await client.GetOptionChainAsync(
    underlyingKey: "NSE_INDEX|Nifty 50",
    expiryDate:    "2024-03-28");

foreach (var row in chain)
{
    var callLtp = row.CallOptions?.MarketData?.Ltp ?? 0;
    var putLtp  = row.PutOptions?.MarketData?.Ltp  ?? 0;
    Console.WriteLine($"Strike {row.StrikePrice}  CE={callLtp}  PE={putLtp}");
}
```

`OptionChainEntry` fields:

| Field | Type | Description |
|---|---|---|
| `StrikePrice` | `decimal` | Strike price |
| `UnderlyingSpotPrice` | `decimal` | Spot price at query time |
| `Pcr` | `decimal` | Put/Call ratio |
| `CallOptions` | `OptionSide?` | CE side data |
| `PutOptions` | `OptionSide?` | PE side data |

`OptionSide` contains `InstrumentKey`, `MarketData` (LTP, OI, volume, bid/ask), and `OptionGreeks` (delta, gamma, theta, vega, iv, PoP).

#### Option contracts (metadata, no live prices)

```csharp
IReadOnlyList<OptionContract> contracts = await client.GetOptionContractsAsync(
    underlyingKey: "NSE_INDEX|Nifty 50",
    expiryDate:    "2024-03-28");  // optional

var contract = contracts.First(c => c.InstrumentType == "CE");
Console.WriteLine($"Lot size: {contract.LotSize}  Freeze qty: {contract.FreezeQuantity}");
```

---

### 4. Place Order by Option Price

The SDK fetches the full option chain, resolves the target strike using `PriceSearchMode`, and places the order on it.

#### `PriceSearchMode`

| Value | Behaviour |
|---|---|
| `Nearest` *(default)* | Strike with LTP **closest** to `TargetPremium` |
| `GreaterThan` | Strike with the **smallest LTP strictly above** `TargetPremium` |
| `LessThan` | Strike with the **largest LTP strictly below** `TargetPremium` |

```csharp
// Nearest (default) — v2
var result = await client.PlaceOrderByOptionPriceAsync(new PlaceOrderByOptionPriceRequest
{
    UnderlyingKey   = "NSE_INDEX|Nifty 50",
    ExpiryDate      = "2024-03-28",
    OptionType      = OptionType.CE,
    TargetPremium   = 50m,
    Quantity        = 50,
    TransactionType = TransactionType.Sell,
});
Console.WriteLine($"Order ID: {result.OrderId}");

// GreaterThan — first strike priced above ₹150
var resultGt = await client.PlaceOrderByOptionPriceAsync(new PlaceOrderByOptionPriceRequest
{
    UnderlyingKey   = "NSE_INDEX|Nifty 50",
    ExpiryDate      = "2024-03-28",
    OptionType      = OptionType.CE,
    TargetPremium   = 150m,
    PriceSearchMode = PriceSearchMode.GreaterThan,
    Quantity        = 50,
    TransactionType = TransactionType.Sell,
});

// LessThan — last strike priced below ₹150 (v3 HFT)
var resultLt = await client.PlaceOrderByOptionPriceV3Async(new PlaceOrderByOptionPriceRequest
{
    UnderlyingKey   = "NSE_INDEX|NIFTY BANK",
    ExpiryDate      = "2024-03-28",
    OptionType      = OptionType.PE,
    TargetPremium   = 150m,
    PriceSearchMode = PriceSearchMode.LessThan,
    Quantity        = 15,
    TransactionType = TransactionType.Buy,
    Slice           = true,
});
Console.WriteLine($"Latency: {resultLt.Latency} ms");
```

---

### 5. Place Order by Strike Type

Resolves a strike relative to the current spot price (ATM, OTM1–OTM5, ITM1–ITM5) and places the order.

```csharp
// ATM CE sell (v2)
var result = await client.PlaceOrderByStrikeAsync(new PlaceOrderByStrikeRequest
{
    UnderlyingKey   = "NSE_INDEX|Nifty 50",
    ExpiryDate      = "2024-03-28",
    OptionType      = OptionType.CE,
    StrikeType      = StrikeType.ATM,
    Quantity        = 50,
    TransactionType = TransactionType.Sell,
});

// OTM2 PE buy (v3 HFT)
var resultV3 = await client.PlaceOrderByStrikeV3Async(new PlaceOrderByStrikeRequest
{
    UnderlyingKey   = "NSE_INDEX|Nifty 50",
    ExpiryDate      = "2024-03-28",
    OptionType      = OptionType.PE,
    StrikeType      = StrikeType.OTM2,
    Quantity        = 50,
    TransactionType = TransactionType.Buy,
    Slice           = true,
});
```

Strike resolution rules:

| Strike | CE | PE |
|---|---|---|
| `ATM` | Closest strike to spot | Closest strike to spot |
| `OTM1`–`OTM5` | n strikes **above** ATM | n strikes **below** ATM |
| `ITM1`–`ITM5` | n strikes **below** ATM | n strikes **above** ATM |

---

### 6. Resolve Order Without Placing

`GetOrderByOptionPriceAsync` and `GetOrderByStrikeAsync` run the same chain resolution logic as their `PlaceOrder*` counterparts but **return the `PlaceOrderRequest` without submitting it**. Use these to inspect, log, or confirm the resolved strike before committing.

```csharp
// Inspect what would be placed by option price
PlaceOrderRequest order = await client.GetOrderByOptionPriceAsync(new PlaceOrderByOptionPriceRequest
{
    UnderlyingKey   = "NSE_INDEX|Nifty 50",
    ExpiryDate      = "2024-03-28",
    OptionType      = OptionType.CE,
    TargetPremium   = 150m,
    PriceSearchMode = PriceSearchMode.GreaterThan,
    Quantity        = 50,
    TransactionType = TransactionType.Sell,
});

Console.WriteLine(order.InstrumentToken); // e.g. "NSE_FO|52618"
Console.WriteLine(order.Quantity);        // 50

// Place it when ready
var result = await client.PlaceOrderV3Async(order);

// Inspect what would be placed by strike type
PlaceOrderRequest strikeOrder = await client.GetOrderByStrikeAsync(new PlaceOrderByStrikeRequest
{
    UnderlyingKey   = "NSE_INDEX|Nifty 50",
    ExpiryDate      = "2024-03-28",
    OptionType      = OptionType.CE,
    StrikeType      = StrikeType.OTM1,
    Quantity        = 50,
    TransactionType = TransactionType.Sell,
});

Console.WriteLine(strikeOrder.InstrumentToken); // resolved OTM1 CE token
```

---

## WebSocket Streaming

Streamers are **stateful** — each instance owns one WebSocket connection. Create them via the `UpstoxClient` factory methods so each caller gets an independent connection:

```csharp
IMarketDataStreamer streamer = client.CreateMarketDataStreamer();
IPortfolioStreamer  portfolio = client.CreatePortfolioStreamer();
```

Always dispose streamers when done (they implement `IAsyncDisposable`).

### Market Data Feed V3

Streams tick data in **protobuf binary** over WebSocket. Supports four feed modes:

| `FeedMode` | Data included |
|---|---|
| `Ltpc` | Last traded price, time, quantity, close price |
| `Full` | LTPC + 5-level depth + OHLC + ATP, VTT, OI, IV + option greeks |
| `OptionGreeks` | LTPC + 1-level depth + greeks + VTT, OI, IV |
| `FullD30` | Same as `Full` but with 30-level depth |

#### Basic usage

```csharp
await using var streamer = client.CreateMarketDataStreamer();

streamer.Connected    += (_, _) => Console.WriteLine("Connected");
streamer.Disconnected += (_, ex) => Console.WriteLine($"Disconnected: {ex?.Message}");
streamer.Reconnecting += (_, _) => Console.WriteLine("Reconnecting…");

streamer.FeedReceived += (_, msg) =>
{
    foreach (var (key, feed) in msg.Instruments)
    {
        if (feed.Ltpc is { } ltpc)
            Console.WriteLine($"{key}  LTP={ltpc.Ltp}  @ {ltpc.Ltt:HH:mm:ss.fff}");
    }
};

streamer.MarketStatusReceived += (_, status) =>
{
    foreach (var (segment, state) in status.Segments)
        Console.WriteLine($"Segment {segment}: {state}");
};

await streamer.ConnectAsync();

// Subscribe to LTPC for the Nifty 50 index
await streamer.SubscribeAsync(["NSE_INDEX|Nifty 50"], FeedMode.Ltpc);

// Subscribe to full mode for multiple instruments
await streamer.SubscribeAsync(
    ["NSE_FO|52618", "NSE_FO|52619"],
    FeedMode.Full);

await Task.Delay(TimeSpan.FromMinutes(5));

await streamer.DisconnectAsync();
```

#### Switch feed mode after subscribing

```csharp
await streamer.ChangeModeAsync(["NSE_FO|52618"], FeedMode.OptionGreeks);
```

#### Unsubscribe instruments

```csharp
await streamer.UnsubscribeAsync(["NSE_FO|52619"]);
```

#### Full feed data fields

```csharp
streamer.FeedReceived += (_, msg) =>
{
    foreach (var (key, feed) in msg.Instruments)
    {
        if (feed.Full is { } full)
        {
            Console.WriteLine($"{key}");
            Console.WriteLine($"  LTP={full.Ltpc.Ltp}  ATP={full.Atp}  OI={full.Oi}");

            if (full.Depth is { } depth)
            {
                Console.WriteLine($"  Best bid: {depth.Bids[0].Price} x {depth.Bids[0].Quantity}");
                Console.WriteLine($"  Best ask: {depth.Asks[0].Price} x {depth.Asks[0].Quantity}");
            }

            if (full.Greeks is { } g)
                Console.WriteLine($"  Delta={g.Delta:F4}  IV={g.Iv:F2}%");

            foreach (var bar in full.Ohlc)
                Console.WriteLine($"  OHLC [{bar.Interval}] O={bar.Open} H={bar.High} L={bar.Low} C={bar.Close}");
        }

        if (feed.OptionGreeks is { } og)
        {
            Console.WriteLine($"{key}  LTP={og.Ltpc.Ltp}  Delta={og.Greeks?.Delta:F4}  Theta={og.Greeks?.Theta:F4}");
        }
    }
};
```

#### `MarketDataMessage` structure

```
MarketDataMessage
├── Type            : MessageType  (InitialFeed | LiveFeed)
├── TimestampMs     : long
├── Timestamp       : DateTimeOffset
└── Instruments     : IReadOnlyDictionary<string, InstrumentFeed>
                          ├── Mode        : FeedMode
                          ├── Ltpc?       : LtpcData
                          │     ├── Ltp   : decimal
                          │     ├── Ltt   : DateTimeOffset
                          │     ├── Ltq   : long
                          │     └── Cp    : decimal
                          ├── Full?       : FullFeedData
                          │     ├── Ltpc  : LtpcData
                          │     ├── Vtt   : long
                          │     ├── Atp   : decimal
                          │     ├── Oi    : decimal
                          │     ├── Iv    : decimal
                          │     ├── Depth?: Depth(Bids, Asks)  ← List<BidAsk>
                          │     ├── Ohlc  : List<OhlcBar>
                          │     ├── Greeks?: Greeks(Delta,Gamma,Theta,Vega,Iv)
                          │     └── IsIndex: bool
                          └── OptionGreeks?: OptionGreeksFeedData
                                ├── Ltpc  : LtpcData
                                ├── Vtt   : long
                                ├── Atp   : decimal
                                ├── Oi    : decimal
                                ├── Iv    : decimal
                                ├── Depth?: Depth
                                └── Greeks?: Greeks
```

#### `IMarketDataStreamer` interface

```csharp
public interface IMarketDataStreamer : IAsyncDisposable
{
    bool IsConnected { get; }

    event EventHandler?                      Connected;
    event EventHandler<Exception?>?          Disconnected;
    event EventHandler?                      Reconnecting;
    event EventHandler?                      AutoReconnectStopped;
    event EventHandler<MarketDataMessage>?   FeedReceived;
    event EventHandler<MarketSegmentStatus>? MarketStatusReceived;

    Task ConnectAsync(CancellationToken cancellationToken = default);
    Task DisconnectAsync();
    Task SubscribeAsync(IEnumerable<string> instrumentKeys, FeedMode mode = FeedMode.Ltpc, CancellationToken ct = default);
    Task UnsubscribeAsync(IEnumerable<string> instrumentKeys, CancellationToken ct = default);
    Task ChangeModeAsync(IEnumerable<string> instrumentKeys, FeedMode mode, CancellationToken ct = default);
}
```

---

### Portfolio Stream Feed V2

Streams order, position, and holding updates as **plain JSON text frames**.

```csharp
await using var portfolio = client.CreatePortfolioStreamer();

portfolio.Connected += (_, _) => Console.WriteLine("Portfolio stream connected");

portfolio.UpdateReceived += (_, update) =>
{
    Console.WriteLine($"Update type: {update.Type}");
    // update.Data is JsonElement? — deserialise to your model as needed
    Console.WriteLine(update.Data?.ToString());
};

// Connect filtering to order and position updates only
await portfolio.ConnectAsync(updateTypes: [UpdateType.Order, UpdateType.Position]);

// Connect receiving all update types
await portfolio.ConnectAsync();
```

#### `UpdateType` values

| Value | API string | Description |
|---|---|---|
| `Order` | `order_update` | Order status changes |
| `Position` | `position_update` | Position quantity/P&L changes |
| `Holding` | `holding_update` | Holding changes |
| `GttOrder` | `gtt_order_update` | GTT order triggers |

#### Parsing `PortfolioStreamUpdate.Data`

```csharp
portfolio.UpdateReceived += (_, update) =>
{
    if (update.Type == "order_update" && update.Data.HasValue)
    {
        var orderId = update.Data.Value.GetProperty("order_id").GetString();
        var status  = update.Data.Value.GetProperty("status").GetString();
        Console.WriteLine($"Order {orderId} → {status}");
    }
};
```

#### `IPortfolioStreamer` interface

```csharp
public interface IPortfolioStreamer : IAsyncDisposable
{
    bool IsConnected { get; }

    event EventHandler?                       Connected;
    event EventHandler<Exception?>?           Disconnected;
    event EventHandler?                       Reconnecting;
    event EventHandler?                       AutoReconnectStopped;
    event EventHandler<PortfolioStreamUpdate>? UpdateReceived;

    Task ConnectAsync(IEnumerable<UpdateType>? updateTypes = null, CancellationToken ct = default);
    Task DisconnectAsync();
}
```

---

## Error Handling

All REST methods throw `UpstoxException` on API or network errors. WebSocket methods throw on initial connect failure; after that, errors are surfaced through the `Disconnected` event.

```csharp
using KAITerminal.Upstox.Exceptions;

try
{
    var result = await client.PlaceOrderAsync(request);
}
catch (UpstoxException ex)
{
    Console.WriteLine($"HTTP {ex.HttpStatusCode}  Code={ex.ErrorCode}  {ex.Message}");

    if (ex.ApiErrors is not null)
        foreach (var e in ex.ApiErrors)
            Console.WriteLine($"  [{e.ErrorCode}] {e.Message}");
}
catch (OperationCanceledException)
{
    Console.WriteLine("Request cancelled");
}
```

`UpstoxException` properties:

| Property | Type | Description |
|---|---|---|
| `Message` | `string` | Human-readable error message |
| `HttpStatusCode` | `int?` | HTTP status code |
| `ErrorCode` | `string?` | Upstox machine-readable error code |
| `ApiErrors` | `IReadOnlyList<UpstoxApiError>?` | Full list of errors from the API |

---

## Models Reference

### `Position`

| Property | Type | Notes |
|---|---|---|
| `InstrumentToken` | `string` | e.g. `"NSE_FO\|52618"` |
| `TradingSymbol` | `string` | Human-readable symbol |
| `Exchange` | `string` | `"NSE"`, `"BSE"`, etc. |
| `Product` | `string` | `"I"`, `"D"`, `"CO"`, `"MTF"` |
| `Quantity` | `int` | Net qty; positive = long, negative = short |
| `AveragePrice` | `decimal` | Average entry price |
| `LastPrice` | `decimal` | Current market price |
| `Pnl` | `decimal` | Total P&L (realised + unrealised) |
| `Realised` | `decimal` | P&L from closed portions |
| `Unrealised` | `decimal` | P&L on open quantity |
| `IsOpen` | `bool` | `true` when `Quantity != 0` |

### `Order`

| Property | Type | Notes |
|---|---|---|
| `OrderId` | `string` | Upstox order ID |
| `InstrumentToken` | `string` | |
| `TradingSymbol` | `string` | |
| `Status` | `string` | `"open"`, `"complete"`, `"rejected"`, `"cancelled"`, etc. |
| `OrderType` | `string` | `"MARKET"`, `"LIMIT"`, `"SL"`, `"SL-M"` |
| `TransactionType` | `string` | `"BUY"` or `"SELL"` |
| `Quantity` | `int` | |
| `FilledQuantity` | `int` | |
| `AveragePrice` | `decimal` | Fill price |
| `Tag` | `string?` | User tag |
| `IsCancellable` | `bool` | `false` for complete/rejected/cancelled |

### `PlaceOrderRequest`

| Property | Type | Default | Notes |
|---|---|---|---|
| `InstrumentToken` | `string` | *(required)* | |
| `Quantity` | `int` | *(required)* | |
| `TransactionType` | `TransactionType` | *(required)* | `Buy` or `Sell` |
| `OrderType` | `OrderType` | `Market` | |
| `Product` | `Product` | `Intraday` | |
| `Validity` | `Validity` | `Day` | |
| `Price` | `decimal` | `0` | Required for `Limit` / `SL` |
| `TriggerPrice` | `decimal` | `0` | Required for `SL` / `SLM` |
| `DisclosedQuantity` | `int` | `0` | |
| `IsAmo` | `bool` | `false` | After-market order |
| `Tag` | `string?` | `null` | User-defined tag |
| `Slice` | `bool` | `false` | v3 only — auto-slice at freeze limit |

### `PlaceOrderResult` / `PlaceOrderV3Result`

```csharp
// v2
public sealed class PlaceOrderResult   { public string OrderId { get; init; } }

// v3
public sealed class PlaceOrderV3Result
{
    public IReadOnlyList<string> OrderIds { get; init; }  // multiple when sliced
    public int Latency { get; init; }                     // API latency in ms
}
```

---

## Enums Reference

### `OrderType`
| Value | API string | Notes |
|---|---|---|
| `Market` | `MARKET` | Instant fill at market price |
| `Limit` | `LIMIT` | Fill at specified `Price` or better |
| `SL` | `SL` | Stop-loss limit — needs `TriggerPrice` + `Price` |
| `SLM` | `SL-M` | Stop-loss market — needs `TriggerPrice` |

### `Product`
| Value | API string | Notes |
|---|---|---|
| `Intraday` | `I` | MIS / intraday position |
| `Delivery` | `D` | NRML / delivery / overnight |
| `MTF` | `MTF` | Margin Trading Facility |
| `CoverOrder` | `CO` | Cover order with stop-loss bracket |

### `TransactionType`
| Value | Description |
|---|---|
| `Buy` | Long entry or short exit |
| `Sell` | Short entry or long exit |

### `Validity`
| Value | Description |
|---|---|
| `Day` | Valid for the current trading day |
| `IOC` | Immediate-or-Cancel |

### `OptionType`
| Value | Description |
|---|---|
| `CE` | Call option |
| `PE` | Put option |

### `StrikeType`
`ATM` · `OTM1` · `OTM2` · `OTM3` · `OTM4` · `OTM5` · `ITM1` · `ITM2` · `ITM3` · `ITM4` · `ITM5`

### `PriceSearchMode`
| Value | Description |
|---|---|
| `Nearest` | Strike with LTP closest to `TargetPremium` (default) |
| `GreaterThan` | Strike with the smallest LTP strictly above `TargetPremium` |
| `LessThan` | Strike with the largest LTP strictly below `TargetPremium` |

### `FeedMode` (WebSocket)
| Value | Description |
|---|---|
| `Ltpc` | LTP, LTT, LTQ, close price only |
| `Full` | Full market data with 5-level depth |
| `OptionGreeks` | First-level depth + option greeks |
| `FullD30` | Full market data with 30-level depth |

### `UpdateType` (WebSocket)
| Value | Description |
|---|---|
| `Order` | Order status changes |
| `Position` | Position updates |
| `Holding` | Holding updates |
| `GttOrder` | GTT order trigger updates |

---

## Usage in ASP.NET Core Minimal API

This example shows a **multi-user** setup where every request carries its own Upstox token (e.g. a trading terminal serving multiple accounts). See the [Multi-User Token Handling](#multi-user-token-handling) section for background.

```csharp
// Program.cs
using KAITerminal.Upstox;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.WebSocket;
using KAITerminal.Upstox.Exceptions;

var builder = WebApplication.CreateBuilder(args);

// No AccessToken in config — each request supplies its own token via UpstoxTokenContext.
builder.Services.AddUpstoxSdk(builder.Configuration);

var app = builder.Build();

// ─── Per-request token middleware ──────────────────────────────────────────────
// Reads the Upstox token from the Authorization header (or any user store)
// and sets it for the duration of each HTTP request.

app.Use(async (ctx, next) =>
{
    var token = ctx.Request.Headers["X-Upstox-Token"].FirstOrDefault();
    using (UpstoxTokenContext.Use(token))
        await next(ctx);
});

// ─── Positions ────────────────────────────────────────────────────────────────

app.MapGet("/positions", async (UpstoxClient client, CancellationToken ct) =>
{
    var positions = await client.GetAllPositionsAsync(ct);
    return Results.Ok(positions);
});

app.MapGet("/positions/mtm", async (UpstoxClient client, CancellationToken ct) =>
{
    var mtm = await client.GetTotalMtmAsync(ct);
    return Results.Ok(new { totalMtm = mtm });
});

app.MapDelete("/positions", async (UpstoxClient client, CancellationToken ct) =>
{
    var ids = await client.ExitAllPositionsAsync(cancellationToken: ct);
    return Results.Ok(new { exitedOrders = ids });
});

// ─── Orders ───────────────────────────────────────────────────────────────────

app.MapGet("/orders", async (UpstoxClient client, CancellationToken ct) =>
    Results.Ok(await client.GetAllOrdersAsync(ct)));

app.MapDelete("/orders", async (UpstoxClient client, CancellationToken ct) =>
{
    var ids = await client.CancelAllPendingOrdersAsync(ct);
    return Results.Ok(new { cancelledOrders = ids });
});

app.MapPost("/orders", async (
    PlaceOrderRequest request,
    UpstoxClient client,
    CancellationToken ct) =>
{
    try
    {
        var result = await client.PlaceOrderAsync(request, ct);
        return Results.Ok(result);
    }
    catch (UpstoxException ex)
    {
        return Results.Problem(
            title:      "Upstox API error",
            detail:     ex.Message,
            statusCode: ex.HttpStatusCode ?? 500);
    }
});

app.MapPost("/orders/v3", async (
    PlaceOrderRequest request,
    UpstoxClient client,
    CancellationToken ct) =>
{
    var result = await client.PlaceOrderV3Async(request, ct);
    return Results.Ok(result);
});

// ─── Options ──────────────────────────────────────────────────────────────────

app.MapGet("/options/chain", async (
    string underlyingKey,
    string expiryDate,
    UpstoxClient client,
    CancellationToken ct) =>
    Results.Ok(await client.GetOptionChainAsync(underlyingKey, expiryDate, ct)));

app.MapPost("/orders/by-premium", async (
    PlaceOrderByOptionPriceRequest request,
    UpstoxClient client,
    CancellationToken ct) =>
{
    var result = await client.PlaceOrderByOptionPriceAsync(request, ct);
    return Results.Ok(result);
});

app.MapPost("/orders/by-strike", async (
    PlaceOrderByStrikeRequest request,
    UpstoxClient client,
    CancellationToken ct) =>
{
    var result = await client.PlaceOrderByStrikeAsync(request, ct);
    return Results.Ok(result);
});

// ─── SSE endpoint — stream live ticks to the browser ─────────────────────────
// The per-request middleware has already set UpstoxTokenContext for this request,
// so ConnectAsync picks up the correct user token automatically.

app.MapGet("/stream/nifty", async (
    UpstoxClient client,
    HttpContext ctx,
    CancellationToken ct) =>
{
    ctx.Response.Headers.ContentType  = "text/event-stream";
    ctx.Response.Headers.CacheControl = "no-cache";

    await using var streamer = client.CreateMarketDataStreamer();

    streamer.FeedReceived += async (_, msg) =>
    {
        if (msg.Instruments.TryGetValue("NSE_INDEX|Nifty 50", out var feed) && feed.Ltpc is { } ltpc)
        {
            var line = $"data: {{\"ltp\":{ltpc.Ltp},\"ltt\":\"{ltpc.Ltt:O}\"}}\n\n";
            await ctx.Response.WriteAsync(line, ct);
            await ctx.Response.Body.FlushAsync(ct);
        }
    };

    await streamer.ConnectAsync(ct); // token from UpstoxTokenContext captured here
    await streamer.SubscribeAsync(["NSE_INDEX|Nifty 50"], FeedMode.Ltpc, ct);

    // Hold the response open until the client disconnects
    try { await Task.Delay(Timeout.Infinite, ct); }
    catch (OperationCanceledException) { }
});

app.Run();
```

### `appsettings.json` (Minimal API — multi-user)

```json
{
  "Upstox": {
    "AutoReconnect": false
  },
  "Logging": {
    "LogLevel": { "Default": "Information" }
  }
}
```

> For a **single-user** Minimal API, add `"AccessToken": "your_token_here"` to the `Upstox` section and remove the per-request middleware.

---

## Usage in .NET Worker Service

A Worker Service is the natural host for persistent WebSocket streams that need to run for the duration of the application.

### Project setup

```xml
<!-- Worker.csproj -->
<Project Sdk="Microsoft.NET.Sdk.Worker">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\KAITerminal.Upstox\KAITerminal.Upstox.csproj" />
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="10.0.0" />
  </ItemGroup>
</Project>
```

### Program.cs

```csharp
using KAITerminal.Upstox.Extensions;

var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((ctx, services) =>
    {
        services.AddUpstoxSdk(ctx.Configuration);
        services.AddHostedService<MarketDataWorker>();
        services.AddHostedService<PortfolioWorker>();
    })
    .Build();

await host.RunAsync();
```

### Market data worker

```csharp
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.WebSocket;

public sealed class MarketDataWorker : BackgroundService
{
    private readonly UpstoxClient _client;
    private readonly ILogger<MarketDataWorker> _logger;

    // Instruments to subscribe — edit as needed
    private static readonly string[] Instruments =
    [
        "NSE_INDEX|Nifty 50",
        "NSE_INDEX|NIFTY BANK"
    ];

    public MarketDataWorker(UpstoxClient client, ILogger<MarketDataWorker> logger)
    {
        _client = client;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await using var streamer = _client.CreateMarketDataStreamer();

        streamer.Connected    += (_, _)  => _logger.LogInformation("Market feed connected");
        streamer.Reconnecting += (_, _)  => _logger.LogWarning("Market feed reconnecting…");
        streamer.Disconnected += (_, ex) => _logger.LogWarning(ex, "Market feed disconnected");
        streamer.AutoReconnectStopped += (_, _) =>
            _logger.LogError("Market feed auto-reconnect exhausted — giving up");

        streamer.FeedReceived += (_, msg) =>
        {
            foreach (var (key, feed) in msg.Instruments)
            {
                if (feed.Ltpc is { } ltpc)
                    _logger.LogInformation("{Key}  LTP={Ltp}", key, ltpc.Ltp);
            }
        };

        streamer.MarketStatusReceived += (_, status) =>
        {
            foreach (var (segment, state) in status.Segments)
                _logger.LogInformation("Segment {Segment}: {State}", segment, state);
        };

        try
        {
            await streamer.ConnectAsync(stoppingToken);
            await streamer.SubscribeAsync(Instruments, FeedMode.Ltpc, stoppingToken);

            // Keep alive until the host shuts down
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Market feed worker stopping");
        }
        finally
        {
            await streamer.DisconnectAsync();
        }
    }
}
```

### Portfolio update worker

```csharp
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.WebSocket;
using System.Text.Json;

public sealed class PortfolioWorker : BackgroundService
{
    private readonly UpstoxClient _client;
    private readonly ILogger<PortfolioWorker> _logger;

    public PortfolioWorker(UpstoxClient client, ILogger<PortfolioWorker> logger)
    {
        _client = client;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await using var streamer = _client.CreatePortfolioStreamer();

        streamer.Connected    += (_, _)  => _logger.LogInformation("Portfolio stream connected");
        streamer.Reconnecting += (_, _)  => _logger.LogWarning("Portfolio stream reconnecting…");
        streamer.Disconnected += (_, ex) => _logger.LogWarning(ex, "Portfolio stream disconnected");

        streamer.UpdateReceived += (_, update) =>
        {
            _logger.LogInformation("Portfolio update: {Type}", update.Type);

            switch (update.Type)
            {
                case "order_update" when update.Data.HasValue:
                    var orderId = update.Data.Value.GetProperty("order_id").GetString();
                    var status  = update.Data.Value.GetProperty("status").GetString();
                    _logger.LogInformation("  Order {OrderId} → {Status}", orderId, status);
                    break;

                case "position_update" when update.Data.HasValue:
                    var token = update.Data.Value.GetProperty("instrument_token").GetString();
                    var qty   = update.Data.Value.GetProperty("quantity").GetInt32();
                    _logger.LogInformation("  Position {Token}  qty={Qty}", token, qty);
                    break;
            }
        };

        try
        {
            await streamer.ConnectAsync(
                updateTypes: [UpdateType.Order, UpdateType.Position],
                ct: stoppingToken);

            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Portfolio worker stopping");
        }
        finally
        {
            await streamer.DisconnectAsync();
        }
    }
}
```

### Combined worker: REST + streaming

```csharp
// Example: every 30 s print P&L; also stream live ticks for risk monitoring
public sealed class RiskMonitorWorker : BackgroundService
{
    private readonly UpstoxClient _client;
    private readonly ILogger<RiskMonitorWorker> _logger;

    public RiskMonitorWorker(UpstoxClient client, ILogger<RiskMonitorWorker> logger)
    {
        _client = client;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await using var streamer = _client.CreateMarketDataStreamer();

        streamer.FeedReceived += (_, msg) =>
        {
            // Real-time tick handler — keep fast, no I/O
            foreach (var (key, feed) in msg.Instruments)
                if (feed.Ltpc is { } ltpc && ltpc.Ltp < 0)
                    _logger.LogWarning("Unexpected negative LTP for {Key}", key);
        };

        await streamer.ConnectAsync(stoppingToken);
        await streamer.SubscribeAsync(["NSE_INDEX|Nifty 50"], FeedMode.Ltpc, stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                var mtm = await _client.GetTotalMtmAsync(stoppingToken);
                _logger.LogInformation("Total MTM: ₹{Mtm:F2}", mtm);

                if (mtm < -50_000)
                {
                    _logger.LogCritical("MTM breach — exiting all positions");
                    await _client.ExitAllPositionsAsync(cancellationToken: stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) { }
        finally
        {
            await streamer.DisconnectAsync();
        }
    }
}
```

### `appsettings.json` (Worker)

```json
{
  "Upstox": {
    "AccessToken": "your_token_here",
    "AutoReconnect": true,
    "ReconnectIntervalSeconds": 3,
    "MaxReconnectAttempts": 10
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  }
}
```

---

## Protobuf & Apple Silicon

The Market Data Feed V3 uses Google Protocol Buffers (binary encoding). The generated C# file is included as a static file (`Protos/MarketDataFeedV3.cs`) rather than being generated at build time.

**Reason:** `Grpc.Tools` (the standard build-time protoc runner) currently ships no `macosx_arm64` binary; it cannot run natively on Apple Silicon without Rosetta 2.

### Re-generating after proto changes

If you modify `Protos/MarketDataFeedV3.proto`, regenerate the C# file with the native Homebrew protoc:

```bash
# Install once
brew install protobuf

# Regenerate (run from the project root)
protoc --csharp_out=Protos --proto_path=Protos Protos/MarketDataFeedV3.proto
```

On Linux / Windows CI (where Grpc.Tools works), you can add the Protobuf item group back to the csproj for automatic generation:

```xml
<!-- Add Grpc.Tools only on non-arm64-macOS CI -->
<ItemGroup>
  <PackageReference Include="Grpc.Tools" Version="2.78.0" PrivateAssets="All" />
</ItemGroup>
<ItemGroup>
  <Protobuf Include="Protos\MarketDataFeedV3.proto" GrpcServices="None" />
</ItemGroup>
```

---

*SDK version 1.2.0 · .NET 10 · Upstox API v2/v3*
