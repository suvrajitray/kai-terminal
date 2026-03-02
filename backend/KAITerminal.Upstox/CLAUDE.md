# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
dotnet build                          # Debug build
dotnet build --configuration Release  # Release build
dotnet format                         # Format code (if dotnet-format is installed)
```

There are no tests in this repository — it is a library intended to be tested by consumer projects.

## Architecture

**KAITerminal.Upstox** is a .NET 10 class library (SDK) that wraps the Upstox REST API v2/v3 and real-time WebSocket feeds into a DI-friendly trading SDK.

### Layered Design

```
Consumer (ASP.NET Core / Worker Service)
    ↓
UpstoxClient         (Facade — single public entry point, delegates to services)
    ↓
Services             (IPositionService, IOrderService, IOptionService,
                      IMarketDataStreamer, IPortfolioStreamer)
    ↓
UpstoxHttpClient     (Internal HTTP layer — REST calls, JSON, error handling)
    ↓
Upstox REST API v2/v3 + WebSocket feeds
```

### Key Files

- **`UpstoxClient.cs`** — Facade exposing all SDK features as async methods. Consumers inject this.
- **`UpstoxTokenContext.cs`** — Public `AsyncLocal<string?>` ambient token. Set per-call to override the configured token (multi-user pattern).
- **`Extensions/ServiceCollectionExtensions.cs`** — `AddUpstoxSdk()` registers all services and wires `UpstoxAuthHandler` into both named HttpClients.
- **`Http/UpstoxHttpClient.cs`** — Wraps all REST calls; handles JSON, errors, and envelope unwrapping.
- **`Http/UpstoxAuthHandler.cs`** — `DelegatingHandler` that injects `Authorization: Bearer` per request. Reads `UpstoxTokenContext.Current` first, falls back to `UpstoxConfig.AccessToken`.
- **`Configuration/UpstoxConfig.cs`** — Config model. `AccessToken` is `string?` (nullable); omit it when using per-call tokens.
- **`Exceptions/UpstoxException.cs`** — Unified exception with `HttpStatusCode`, `ErrorCode`, and `ApiErrors`.
- **`Protos/MarketDataFeedV3.cs`** — Pre-generated protobuf C# file (do not delete; see Protobuf note below).

### Two Named HttpClients

- **"UpstoxApi"** → `https://api.upstox.com` — read-only REST (positions, orders, option chain)
- **"UpstoxHft"** → `https://api-hft.upstox.com` — order writes (lower latency HFT endpoint)

Both clients have `UpstoxAuthHandler` registered as a message handler. The `Authorization` header is **not** set in `DefaultRequestHeaders` — it is injected per request by the handler.

### WebSocket Streamers

- **`MarketDataStreamer`** — Protobuf binary feed (V3). 4 feed modes: `Ltpc`, `Full`, `OptionGreeks`, `FullD30`.
- **`PortfolioStreamer`** — JSON text frames (V2). Emits typed events for orders, positions, holdings, GTT orders.

Both implement `IAsyncDisposable`, support auto-reconnect with configurable backoff, and are registered as **Transient** (each instance owns its own WebSocket connection). All other services are **Singleton**.

Both streamers capture `UpstoxTokenContext.Current` at `ConnectAsync()` time and restore it inside `RunAutoReconnectAsync()` so reconnects always use the same token, even after the original async scope is gone.

### Protobuf / Apple Silicon Note

`Protos/MarketDataFeedV3.cs` is pre-generated because `Grpc.Tools` does not ship a native `macosx_arm64` binary. If `MarketDataFeedV3.proto` is modified, regenerate with:

```bash
brew install protobuf
protoc --csharp_out=Protos --proto_path=Protos Protos/MarketDataFeedV3.proto
```

## Consumer Integration Patterns

### Single-user / Worker Service (static token in config)

```csharp
builder.Services.AddUpstoxSdk(builder.Configuration);
// OR:
builder.Services.AddUpstoxSdk(cfg => { cfg.AccessToken = "daily_oauth_token"; });
```

```json
{
  "Upstox": {
    "AccessToken": "daily_oauth_token",
    "AutoReconnect": true,
    "ReconnectIntervalSeconds": 3,
    "MaxReconnectAttempts": 5
  }
}
```

### Multi-user / Trading Terminal (per-call token)

```csharp
// Registration — no AccessToken in config
builder.Services.AddUpstoxSdk(cfg => { cfg.AutoReconnect = false; });

// Per call — token flows through all awaits via AsyncLocal
using (UpstoxTokenContext.Use(currentUser.UpstoxToken))
{
    var positions = await upstoxClient.GetAllPositionsAsync();
    var orders    = await upstoxClient.GetAllOrdersAsync();
}

// WebSocket — token captured at connect time, reused on reconnects
using (UpstoxTokenContext.Use(currentUser.UpstoxToken))
    await streamer.ConnectAsync();
```

ASP.NET Core middleware pattern:

```csharp
app.Use(async (ctx, next) =>
{
    var token = ctx.Request.Headers["X-Upstox-Token"].FirstOrDefault();
    using (UpstoxTokenContext.Use(token))
        await next(ctx);
});
```

## Design Conventions

- All public methods are `async Task<T>` and accept `CancellationToken`.
- All API errors surface as `UpstoxException`; network errors propagate naturally.
- WebSocket errors surface through the `Disconnected` event, not thrown exceptions.
- Concurrent bulk operations (exit all positions, cancel all orders) use `Task.WhenAll()`.
- Response models use `[JsonPropertyName]` with camelCase names to match Upstox JSON envelopes.
- Internal DTOs (e.g. `PlaceOrderDto`, `UpstoxEnvelope<T>`) live inside `UpstoxHttpClient.cs` as private nested classes — they are serialisation-only and not part of the public API.
- `UpstoxTokenContext` is the only mechanism for per-call token injection. Do not add `accessToken` parameters to service or facade methods.
