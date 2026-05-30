# SEBI Order Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all order placement through per-user Docker containers bound to dedicated static IPs, satisfying SEBI's requirement that each user's broker API calls originate from their registered IP.

**Architecture:** A new `KAITerminal.OrderAgent` minimal API runs one container per user, with its `HttpClient` bound to a specific IP via `SocketsHttpHandler.ConnectCallback`. A new `KAITerminal.OrderRouting` library provides `IOrderRouter` — the single routing point used by Api endpoints, `ByPriceOrderService`, `PositionShiftService`, and a Worker `IBrokerClient` decorator. If no agent is registered for a user, all paths fall back to direct broker calls (today's behaviour).

**Tech Stack:** .NET 10, ASP.NET Core Minimal API, EF Core + PostgreSQL, Docker Compose, `SocketsHttpHandler.ConnectCallback` for IP binding.

**Spec:** `docs/superpowers/specs/2026-05-28-sebi-order-agent-design.md`

---

## File Map

**New files:**
```
backend/KAITerminal.OrderRouting/
  KAITerminal.OrderRouting.csproj
  AgentRegistration.cs
  IOrderAgentRegistry.cs
  OrderAgentRegistry.cs
  IOrderAgentClient.cs
  HttpOrderAgentClient.cs
  IOrderRouter.cs
  OrderRouter.cs
  Models/UpstoxOrderRequest.cs
  Models/ZerodhaOrderRequest.cs

backend/KAITerminal.OrderAgent/
  KAITerminal.OrderAgent.csproj
  Program.cs
  appsettings.json
  Endpoints/UpstoxAgentEndpoints.cs
  Endpoints/ZerodhaAgentEndpoints.cs
  Dockerfile

backend/KAITerminal.Infrastructure/Data/UserOrderAgent.cs

backend/KAITerminal.Api/Endpoints/AdminOrderAgentEndpoints.cs
```

**Modified files:**
```
backend/KAITerminal.slnx
backend/KAITerminal.Infrastructure/Data/AppDbContext.cs
backend/KAITerminal.Api/KAITerminal.Api.csproj
backend/KAITerminal.Api/Program.cs
backend/KAITerminal.Api/Endpoints/UpstoxOrderEndpoints.cs
backend/KAITerminal.Api/Endpoints/ZerodhaOrderEndpoints.cs
backend/KAITerminal.Api/Services/ByPriceOrderService.cs
backend/KAITerminal.Api/Services/PositionShiftService.cs
backend/KAITerminal.Worker/KAITerminal.Worker.csproj
backend/KAITerminal.Worker/Program.cs
backend/KAITerminal.Worker/StreamingRiskWorker.cs (in KAITerminal.RiskEngine)
backend/KAITerminal.Worker/OrderRouting/OrderRoutingBrokerClient.cs  (new)
docker-compose.yml  (new — root of repo or backend/)
```

---

## Task 1: DB Entity + AppDbContext

**Files:**
- Create: `backend/KAITerminal.Infrastructure/Data/UserOrderAgent.cs`
- Modify: `backend/KAITerminal.Infrastructure/Data/AppDbContext.cs`

- [ ] **Step 1: Create the `UserOrderAgent` entity**

```csharp
// backend/KAITerminal.Infrastructure/Data/UserOrderAgent.cs
namespace KAITerminal.Infrastructure.Data;

public class UserOrderAgent
{
    public string Username  { get; set; } = string.Empty;
    public string AgentUrl  { get; set; } = string.Empty;
    public string AgentKey  { get; set; } = string.Empty;
    public string StaticIp  { get; set; } = string.Empty;
    public bool   IsEnabled { get; set; } = true;
}
```

- [ ] **Step 2: Add `DbSet` and primary key to `AppDbContext`**

In `backend/KAITerminal.Infrastructure/Data/AppDbContext.cs`, add after the last `DbSet` line:

```csharp
public DbSet<UserOrderAgent> UserOrderAgents => Set<UserOrderAgent>();
```

In `OnModelCreating`, add after the last `modelBuilder.Entity` block:

```csharp
modelBuilder.Entity<UserOrderAgent>()
    .HasKey(x => x.Username);
```

- [ ] **Step 3: Verify build**

```bash
cd backend && dotnet build KAITerminal.Infrastructure/KAITerminal.Infrastructure.csproj
```

Expected: `Build succeeded`

- [ ] **Step 4: Run the DB migration SQL on the server**

```sql
CREATE TABLE "UserOrderAgents" (
    "Username"   VARCHAR NOT NULL PRIMARY KEY,
    "AgentUrl"   VARCHAR NOT NULL,
    "AgentKey"   VARCHAR NOT NULL,
    "StaticIp"   VARCHAR NOT NULL,
    "IsEnabled"  BOOLEAN NOT NULL DEFAULT true
);
```

---

## Task 2: `KAITerminal.OrderRouting` — Project + Contract Models

**Files:**
- Create: `backend/KAITerminal.OrderRouting/KAITerminal.OrderRouting.csproj`
- Create: `backend/KAITerminal.OrderRouting/Models/UpstoxOrderRequest.cs`
- Create: `backend/KAITerminal.OrderRouting/Models/ZerodhaOrderRequest.cs`
- Modify: `backend/KAITerminal.slnx`

- [ ] **Step 1: Create the project file**

```xml
<!-- backend/KAITerminal.OrderRouting/KAITerminal.OrderRouting.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="../KAITerminal.Infrastructure/KAITerminal.Infrastructure.csproj" />
    <ProjectReference Include="../KAITerminal.Contracts/KAITerminal.Contracts.csproj" />
    <ProjectReference Include="../KAITerminal.Upstox/KAITerminal.Upstox.csproj" />
    <ProjectReference Include="../KAITerminal.Zerodha/KAITerminal.Zerodha.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Register in the solution**

In `backend/KAITerminal.slnx`, add inside `<Solution>`:

```xml
<Project Path="KAITerminal.OrderRouting/KAITerminal.OrderRouting.csproj" />
```

- [ ] **Step 3: Create `UpstoxOrderRequest`**

Uses strings for Upstox enum values so no SDK enum dependency crosses the network boundary.

```csharp
// backend/KAITerminal.OrderRouting/Models/UpstoxOrderRequest.cs
namespace KAITerminal.OrderRouting.Models;

/// <summary>Body of POST /upstox/orders on the OrderAgent.</summary>
public sealed record UpstoxOrderRequest(
    string  InstrumentToken,
    int     Quantity,
    string  TransactionType,    // TransactionType enum name: "Buy" or "Sell"
    string  OrderType,          // OrderType enum name: "Market", "Limit", "SL", "SLM"
    string  Product,            // Product enum name: "Intraday", "Delivery", "MTF", "CoverOrder"
    string  Validity,           // Validity enum name: "Day" or "IOC"
    decimal Price,
    decimal TriggerPrice,
    bool    Slice,
    string? Tag);
```

- [ ] **Step 4: Create `ZerodhaOrderRequest`**

```csharp
// backend/KAITerminal.OrderRouting/Models/ZerodhaOrderRequest.cs
namespace KAITerminal.OrderRouting.Models;

/// <summary>Body of POST /zerodha/orders on the OrderAgent.</summary>
public sealed record ZerodhaOrderRequest(
    string   InstrumentToken,
    int      Quantity,
    string   TransactionType,   // "BUY" or "SELL"
    string   Product,           // "I", "D", "NRML"
    string   OrderType,         // "MARKET" or "LIMIT"
    decimal? Price,
    decimal? TriggerPrice,
    string?  Exchange,
    string?  Tag);
```

- [ ] **Step 5: Verify build**

```bash
cd backend && dotnet build KAITerminal.OrderRouting/KAITerminal.OrderRouting.csproj
```

Expected: `Build succeeded`

---

## Task 3: `KAITerminal.OrderRouting` — Registry

**Files:**
- Create: `backend/KAITerminal.OrderRouting/AgentRegistration.cs`
- Create: `backend/KAITerminal.OrderRouting/IOrderAgentRegistry.cs`
- Create: `backend/KAITerminal.OrderRouting/OrderAgentRegistry.cs`

- [ ] **Step 1: Create `AgentRegistration`**

```csharp
// backend/KAITerminal.OrderRouting/AgentRegistration.cs
namespace KAITerminal.OrderRouting;

public sealed record AgentRegistration(string Url, string Key);
```

- [ ] **Step 2: Create `IOrderAgentRegistry`**

```csharp
// backend/KAITerminal.OrderRouting/IOrderAgentRegistry.cs
namespace KAITerminal.OrderRouting;

public interface IOrderAgentRegistry
{
    /// <summary>Returns agent URL + key for the user, or null if not registered.</summary>
    AgentRegistration? GetAgent(string username);

    /// <summary>Updates the in-memory dictionary. Caller is responsible for DB persistence.</summary>
    void Upsert(string username, string agentUrl, string agentKey);

    /// <summary>Removes the user's agent from the in-memory dictionary.</summary>
    void Remove(string username);

    /// <summary>Loads all enabled agents from DB. Call once at startup.</summary>
    Task LoadAsync(CancellationToken ct = default);
}
```

- [ ] **Step 3: Create `OrderAgentRegistry`**

```csharp
// backend/KAITerminal.OrderRouting/OrderAgentRegistry.cs
using System.Collections.Concurrent;
using KAITerminal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace KAITerminal.OrderRouting;

public sealed class OrderAgentRegistry : IOrderAgentRegistry
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ConcurrentDictionary<string, AgentRegistration> _agents
        = new(StringComparer.OrdinalIgnoreCase);

    public OrderAgentRegistry(IServiceScopeFactory scopeFactory)
        => _scopeFactory = scopeFactory;

    public AgentRegistration? GetAgent(string username)
        => _agents.TryGetValue(username, out var reg) ? reg : null;

    public void Upsert(string username, string agentUrl, string agentKey)
        => _agents[username] = new AgentRegistration(agentUrl, agentKey);

    public void Remove(string username)
        => _agents.TryRemove(username, out _);

    public async Task LoadAsync(CancellationToken ct = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var agents = await db.UserOrderAgents
            .Where(a => a.IsEnabled)
            .ToListAsync(ct);
        foreach (var a in agents)
            _agents[a.Username] = new AgentRegistration(a.AgentUrl, a.AgentKey);
    }
}
```

- [ ] **Step 4: Verify build**

```bash
cd backend && dotnet build KAITerminal.OrderRouting/KAITerminal.OrderRouting.csproj
```

Expected: `Build succeeded`

---

## Task 4: `KAITerminal.OrderRouting` — Agent HTTP Client

**Files:**
- Create: `backend/KAITerminal.OrderRouting/IOrderAgentClient.cs`
- Create: `backend/KAITerminal.OrderRouting/HttpOrderAgentClient.cs`

- [ ] **Step 1: Create `IOrderAgentClient`**

```csharp
// backend/KAITerminal.OrderRouting/IOrderAgentClient.cs
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.OrderRouting;

public interface IOrderAgentClient
{
    Task<PlaceOrderV3Result> PlaceUpstoxOrderAsync(
        string agentUrl, string agentKey, string accessToken,
        PlaceOrderRequest request, CancellationToken ct = default);

    Task<(string OrderId, int Latency)> CancelUpstoxOrderAsync(
        string agentUrl, string agentKey, string accessToken,
        string orderId, CancellationToken ct = default);

    Task<IReadOnlyList<string>> CancelAllUpstoxOrdersAsync(
        string agentUrl, string agentKey, string accessToken,
        CancellationToken ct = default);

    Task<string> PlaceZerodhaOrderAsync(
        string agentUrl, string agentKey, string accessToken, string apiKey,
        BrokerOrderRequest request, CancellationToken ct = default);

    Task<string> CancelZerodhaOrderAsync(
        string agentUrl, string agentKey, string accessToken, string apiKey,
        string orderId, CancellationToken ct = default);

    Task<IReadOnlyList<string>> CancelAllZerodhaOrdersAsync(
        string agentUrl, string agentKey, string accessToken, string apiKey,
        CancellationToken ct = default);
}
```

- [ ] **Step 2: Create `HttpOrderAgentClient`**

```csharp
// backend/KAITerminal.OrderRouting/HttpOrderAgentClient.cs
using System.Net.Http.Json;
using KAITerminal.Contracts.Domain;
using KAITerminal.OrderRouting.Models;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.OrderRouting;

public sealed class HttpOrderAgentClient : IOrderAgentClient
{
    private readonly HttpClient _http;

    public HttpOrderAgentClient(IHttpClientFactory factory)
        => _http = factory.CreateClient("OrderAgent");

    public async Task<PlaceOrderV3Result> PlaceUpstoxOrderAsync(
        string agentUrl, string agentKey, string accessToken,
        PlaceOrderRequest request, CancellationToken ct = default)
    {
        var body = new UpstoxOrderRequest(
            request.InstrumentToken,
            request.Quantity,
            request.TransactionType.ToString(),
            request.OrderType.ToString(),
            request.Product.ToString(),
            request.Validity.ToString(),
            request.Price,
            request.TriggerPrice,
            request.Slice,
            request.Tag);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{agentUrl}/upstox/orders");
        req.Headers.Add("X-Agent-Key", agentKey);
        req.Headers.Add("X-Upstox-Access-Token", accessToken);
        req.Content = JsonContent.Create(body);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<PlaceOrderV3Result>(ct)
               ?? throw new InvalidOperationException("Empty response from order agent");
    }

    public async Task<(string OrderId, int Latency)> CancelUpstoxOrderAsync(
        string agentUrl, string agentKey, string accessToken,
        string orderId, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"{agentUrl}/upstox/orders/{orderId}");
        req.Headers.Add("X-Agent-Key", agentKey);
        req.Headers.Add("X-Upstox-Access-Token", accessToken);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CancelResult>(ct)
                     ?? throw new InvalidOperationException("Empty cancel response from order agent");
        return (result.OrderId, result.Latency);
    }

    public async Task<IReadOnlyList<string>> CancelAllUpstoxOrdersAsync(
        string agentUrl, string agentKey, string accessToken,
        CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"{agentUrl}/upstox/orders/cancel-all");
        req.Headers.Add("X-Agent-Key", agentKey);
        req.Headers.Add("X-Upstox-Access-Token", accessToken);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CancelAllResult>(ct)
                     ?? throw new InvalidOperationException("Empty cancel-all response from order agent");
        return result.OrderIds;
    }

    public async Task<string> PlaceZerodhaOrderAsync(
        string agentUrl, string agentKey, string accessToken, string apiKey,
        BrokerOrderRequest request, CancellationToken ct = default)
    {
        var body = new ZerodhaOrderRequest(
            request.InstrumentToken,
            request.Quantity,
            request.TransactionType,
            request.Product,
            request.OrderType,
            request.Price,
            request.TriggerPrice,
            request.Exchange,
            request.Tag);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{agentUrl}/zerodha/orders");
        req.Headers.Add("X-Agent-Key", agentKey);
        req.Headers.Add("X-Zerodha-Api-Key", apiKey);
        req.Headers.Add("X-Zerodha-Access-Token", accessToken);
        req.Content = JsonContent.Create(body);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<PlaceZerodhaResult>(ct)
                     ?? throw new InvalidOperationException("Empty response from order agent");
        return result.OrderId;
    }

    public async Task<string> CancelZerodhaOrderAsync(
        string agentUrl, string agentKey, string accessToken, string apiKey,
        string orderId, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"{agentUrl}/zerodha/orders/{orderId}");
        req.Headers.Add("X-Agent-Key", agentKey);
        req.Headers.Add("X-Zerodha-Api-Key", apiKey);
        req.Headers.Add("X-Zerodha-Access-Token", accessToken);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CancelZerodhaResult>(ct)
                     ?? throw new InvalidOperationException("Empty cancel response from order agent");
        return result.OrderId;
    }

    public async Task<IReadOnlyList<string>> CancelAllZerodhaOrdersAsync(
        string agentUrl, string agentKey, string accessToken, string apiKey,
        CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Delete, $"{agentUrl}/zerodha/orders/cancel-all");
        req.Headers.Add("X-Agent-Key", agentKey);
        req.Headers.Add("X-Zerodha-Api-Key", apiKey);
        req.Headers.Add("X-Zerodha-Access-Token", accessToken);

        var response = await _http.SendAsync(req, ct);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<CancelAllResult>(ct)
                     ?? throw new InvalidOperationException("Empty cancel-all response from order agent");
        return result.OrderIds;
    }

    private sealed record CancelResult(string OrderId, int Latency);
    private sealed record CancelZerodhaResult(string OrderId);
    private sealed record CancelAllResult(IReadOnlyList<string> OrderIds);
    private sealed record PlaceZerodhaResult(string OrderId);
}
```

- [ ] **Step 3: Verify build**

```bash
cd backend && dotnet build KAITerminal.OrderRouting/KAITerminal.OrderRouting.csproj
```

Expected: `Build succeeded`

---

## Task 5: `KAITerminal.OrderRouting` — `IOrderRouter` + `OrderRouter`

**Files:**
- Create: `backend/KAITerminal.OrderRouting/IOrderRouter.cs`
- Create: `backend/KAITerminal.OrderRouting/OrderRouter.cs`

- [ ] **Step 1: Create `IOrderRouter`**

```csharp
// backend/KAITerminal.OrderRouting/IOrderRouter.cs
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;

namespace KAITerminal.OrderRouting;

public interface IOrderRouter
{
    // Upstox — all placement via HFT endpoint
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

- [ ] **Step 2: Create `OrderRouter`**

```csharp
// backend/KAITerminal.OrderRouting/OrderRouter.cs
using KAITerminal.Contracts.Domain;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Models.Responses;
using KAITerminal.Zerodha;

namespace KAITerminal.OrderRouting;

public sealed class OrderRouter : IOrderRouter
{
    private readonly IOrderAgentRegistry _registry;
    private readonly IOrderAgentClient   _agentClient;
    private readonly UpstoxClient        _upstox;
    private readonly ZerodhaClient       _zerodha;

    public OrderRouter(
        IOrderAgentRegistry registry,
        IOrderAgentClient   agentClient,
        UpstoxClient        upstox,
        ZerodhaClient       zerodha)
    {
        _registry    = registry;
        _agentClient = agentClient;
        _upstox      = upstox;
        _zerodha     = zerodha;
    }

    public async Task<PlaceOrderV3Result> PlaceUpstoxOrderAsync(
        string username, string accessToken,
        PlaceOrderRequest request, CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.PlaceUpstoxOrderAsync(agent.Url, agent.Key, accessToken, request, ct);

        using var _ = UpstoxTokenContext.Use(accessToken);
        return await _upstox.Hft.PlaceOrderV3Async(request, ct);
    }

    public async Task<(string OrderId, int Latency)> CancelUpstoxOrderAsync(
        string username, string accessToken,
        string orderId, CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.CancelUpstoxOrderAsync(agent.Url, agent.Key, accessToken, orderId, ct);

        using var _ = UpstoxTokenContext.Use(accessToken);
        return await _upstox.Hft.CancelOrderV3Async(orderId, ct);
    }

    public async Task<IReadOnlyList<string>> CancelAllUpstoxOrdersAsync(
        string username, string accessToken,
        CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.CancelAllUpstoxOrdersAsync(agent.Url, agent.Key, accessToken, ct);

        using var _ = UpstoxTokenContext.Use(accessToken);
        return await _upstox.Orders.CancelAllPendingOrdersAsync(ct);
    }

    public async Task<string> PlaceZerodhaOrderAsync(
        string username, string accessToken, string apiKey,
        BrokerOrderRequest request, CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.PlaceZerodhaOrderAsync(agent.Url, agent.Key, accessToken, apiKey, request, ct);

        using var _ = ZerodhaTokenContext.Use(apiKey, accessToken);
        return await _zerodha.Orders.PlaceOrderAsync(request, ct);
    }

    public async Task<string> CancelZerodhaOrderAsync(
        string username, string accessToken, string apiKey,
        string orderId, CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.CancelZerodhaOrderAsync(agent.Url, agent.Key, accessToken, apiKey, orderId, ct);

        using var _ = ZerodhaTokenContext.Use(apiKey, accessToken);
        return await _zerodha.Orders.CancelOrderAsync(orderId, ct);
    }

    public async Task<IReadOnlyList<string>> CancelAllZerodhaOrdersAsync(
        string username, string accessToken, string apiKey,
        CancellationToken ct = default)
    {
        var agent = _registry.GetAgent(username);
        if (agent is not null)
            return await _agentClient.CancelAllZerodhaOrdersAsync(agent.Url, agent.Key, accessToken, apiKey, ct);

        using var _ = ZerodhaTokenContext.Use(apiKey, accessToken);
        return await _zerodha.Orders.CancelAllPendingOrdersAsync(ct);
    }
}
```

- [ ] **Step 3: Verify build**

```bash
cd backend && dotnet build KAITerminal.OrderRouting/KAITerminal.OrderRouting.csproj
```

Expected: `Build succeeded`

---

## Task 6: `KAITerminal.OrderAgent` — Project + IP Binding + Auth

**Files:**
- Create: `backend/KAITerminal.OrderAgent/KAITerminal.OrderAgent.csproj`
- Create: `backend/KAITerminal.OrderAgent/Program.cs`
- Create: `backend/KAITerminal.OrderAgent/appsettings.json`
- Modify: `backend/KAITerminal.slnx`

- [ ] **Step 1: Create the project file**

```xml
<!-- backend/KAITerminal.OrderAgent/KAITerminal.OrderAgent.csproj -->
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="../KAITerminal.OrderRouting/KAITerminal.OrderRouting.csproj" />
    <ProjectReference Include="../KAITerminal.Upstox/KAITerminal.Upstox.csproj" />
    <ProjectReference Include="../KAITerminal.Zerodha/KAITerminal.Zerodha.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Register in solution**

In `backend/KAITerminal.slnx`, add inside `<Solution>`:

```xml
<Project Path="KAITerminal.OrderAgent/KAITerminal.OrderAgent.csproj" />
```

- [ ] **Step 3: Create `appsettings.json`**

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Upstox": {
    "ApiBaseUrl": "https://api.upstox.com",
    "HftBaseUrl": "https://api-hft.upstox.com"
  },
  "Zerodha": {
    "ApiBaseUrl": "https://api.kite.trade"
  }
}
```

- [ ] **Step 4: Create `Program.cs`**

```csharp
// backend/KAITerminal.OrderAgent/Program.cs
using System.Net;
using System.Net.Sockets;
using KAITerminal.OrderAgent.Endpoints;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Zerodha.Extensions;

var builder = WebApplication.CreateBuilder(args);

var bindIp  = IPAddress.Parse(builder.Configuration["BindIp"]
    ?? throw new InvalidOperationException("BindIp is required"));
var agentKey = builder.Configuration["AgentKey"]
    ?? throw new InvalidOperationException("AgentKey is required");

builder.Services.AddUpstoxSdk(builder.Configuration);
builder.Services.AddZerodhaSdk(builder.Configuration);

// Override primary HTTP handlers for all broker SDK named clients to bind outbound sockets to BIND_IP.
// ConfigurePrimaryHttpMessageHandler on an already-registered name sets the innermost handler — the
// SDK's delegating handlers (auth token injection) remain on top of the pipeline.
foreach (var name in new[] { "UpstoxApi", "UpstoxHft", "UpstoxAuth", "ZerodhaApi", "ZerodhaAuth" })
{
    var captured = bindIp; // avoid closure over loop variable
    builder.Services.AddHttpClient(name)
        .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            ConnectCallback = async (ctx, ct) =>
            {
                var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
                socket.Bind(new IPEndPoint(captured, 0));
                await socket.ConnectAsync(ctx.DnsEndPoint, ct);
                return new NetworkStream(socket, ownsSocket: true);
            }
        });
}

var app = builder.Build();

// Auth: every request must present X-Agent-Key matching config
app.Use(async (ctx, next) =>
{
    var key = ctx.Request.Headers["X-Agent-Key"].FirstOrDefault();
    if (key != agentKey)
    {
        ctx.Response.StatusCode = 401;
        return;
    }
    await next(ctx);
});

UpstoxAgentEndpoints.Map(app);
ZerodhaAgentEndpoints.Map(app);

app.Run();
```

- [ ] **Step 5: Verify build**

```bash
cd backend && dotnet build KAITerminal.OrderAgent/KAITerminal.OrderAgent.csproj
```

Expected: `Build succeeded`

---

## Task 7: `KAITerminal.OrderAgent` — Upstox Endpoints

**Files:**
- Create: `backend/KAITerminal.OrderAgent/Endpoints/UpstoxAgentEndpoints.cs`

- [ ] **Step 1: Create Upstox endpoints**

```csharp
// backend/KAITerminal.OrderAgent/Endpoints/UpstoxAgentEndpoints.cs
using KAITerminal.Broker;
using KAITerminal.OrderRouting.Models;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Upstox.Services;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.OrderAgent.Endpoints;

internal static class UpstoxAgentEndpoints
{
    internal static void Map(WebApplication app)
    {
        // cancel-all MUST be registered before {orderId} to prevent routing ambiguity
        app.MapDelete("/upstox/orders/cancel-all", async (
            HttpContext ctx,
            IBrokerOrderService orders,
            CancellationToken ct) =>
        {
            var token = RequireHeader(ctx, "X-Upstox-Access-Token");
            using var _ = UpstoxTokenContext.Use(token);
            var ids = await orders.CancelAllPendingOrdersAsync(ct);
            return Results.Ok(new { orderIds = ids });
        });

        app.MapDelete("/upstox/orders/{orderId}", async (
            string orderId,
            HttpContext ctx,
            IUpstoxHftService hft,
            CancellationToken ct) =>
        {
            var token = RequireHeader(ctx, "X-Upstox-Access-Token");
            using var _ = UpstoxTokenContext.Use(token);
            var (id, latency) = await hft.CancelOrderV3Async(orderId, ct);
            return Results.Ok(new { orderId = id, latency });
        });

        app.MapPost("/upstox/orders", async (
            HttpContext ctx,
            [FromBody] UpstoxOrderRequest request,
            IUpstoxHftService hft,
            CancellationToken ct) =>
        {
            var token = RequireHeader(ctx, "X-Upstox-Access-Token");
            using var _ = UpstoxTokenContext.Use(token);

            var upstoxRequest = new PlaceOrderRequest
            {
                InstrumentToken = request.InstrumentToken,
                Quantity        = request.Quantity,
                TransactionType = Enum.Parse<TransactionType>(request.TransactionType),
                OrderType       = Enum.Parse<OrderType>(request.OrderType),
                Product         = Enum.Parse<Product>(request.Product),
                Validity        = Enum.Parse<Validity>(request.Validity),
                Price           = request.Price,
                TriggerPrice    = request.TriggerPrice,
                Slice           = request.Slice,
                Tag             = request.Tag
            };

            var result = await hft.PlaceOrderV3Async(upstoxRequest, ct);
            return Results.Ok(result);
        });
    }

    private static string RequireHeader(HttpContext ctx, string name)
        => ctx.Request.Headers[name].FirstOrDefault()
           ?? throw new BadHttpRequestException($"{name} header is required", 400);
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && dotnet build KAITerminal.OrderAgent/KAITerminal.OrderAgent.csproj
```

Expected: `Build succeeded`

---

## Task 8: `KAITerminal.OrderAgent` — Zerodha Endpoints

**Files:**
- Create: `backend/KAITerminal.OrderAgent/Endpoints/ZerodhaAgentEndpoints.cs`

- [ ] **Step 1: Create Zerodha endpoints**

```csharp
// backend/KAITerminal.OrderAgent/Endpoints/ZerodhaAgentEndpoints.cs
using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.OrderRouting.Models;
using KAITerminal.Zerodha;
using Microsoft.AspNetCore.Mvc;

namespace KAITerminal.OrderAgent.Endpoints;

internal static class ZerodhaAgentEndpoints
{
    internal static void Map(WebApplication app)
    {
        // cancel-all MUST be registered before {orderId}
        app.MapDelete("/zerodha/orders/cancel-all", async (
            HttpContext ctx,
            IBrokerOrderService orders,
            CancellationToken ct) =>
        {
            var (apiKey, token) = RequireZerodhaHeaders(ctx);
            using var _ = ZerodhaTokenContext.Use(apiKey, token);
            var ids = await orders.CancelAllPendingOrdersAsync(ct);
            return Results.Ok(new { orderIds = ids });
        });

        app.MapDelete("/zerodha/orders/{orderId}", async (
            string orderId,
            HttpContext ctx,
            IBrokerOrderService orders,
            CancellationToken ct) =>
        {
            var (apiKey, token) = RequireZerodhaHeaders(ctx);
            using var _ = ZerodhaTokenContext.Use(apiKey, token);
            var id = await orders.CancelOrderAsync(orderId, ct);
            return Results.Ok(new { orderId = id });
        });

        app.MapPost("/zerodha/orders", async (
            HttpContext ctx,
            [FromBody] ZerodhaOrderRequest request,
            IBrokerOrderService orders,
            CancellationToken ct) =>
        {
            var (apiKey, token) = RequireZerodhaHeaders(ctx);
            using var _ = ZerodhaTokenContext.Use(apiKey, token);

            var brokerRequest = new BrokerOrderRequest(
                request.InstrumentToken,
                request.Quantity,
                request.TransactionType,
                request.Product,
                request.OrderType,
                request.Price,
                request.TriggerPrice,
                request.Exchange,
                request.Tag);

            var orderId = await orders.PlaceOrderAsync(brokerRequest, ct);
            return Results.Ok(new { orderId });
        });
    }

    private static (string ApiKey, string Token) RequireZerodhaHeaders(HttpContext ctx)
    {
        var apiKey = ctx.Request.Headers["X-Zerodha-Api-Key"].FirstOrDefault()
                     ?? throw new BadHttpRequestException("X-Zerodha-Api-Key header is required", 400);
        var token  = ctx.Request.Headers["X-Zerodha-Access-Token"].FirstOrDefault()
                     ?? throw new BadHttpRequestException("X-Zerodha-Access-Token header is required", 400);
        return (apiKey, token);
    }
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && dotnet build KAITerminal.OrderAgent/KAITerminal.OrderAgent.csproj
```

Expected: `Build succeeded`

---

## Task 9: `KAITerminal.OrderAgent` — Dockerfile

**Files:**
- Create: `backend/KAITerminal.OrderAgent/Dockerfile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# backend/KAITerminal.OrderAgent/Dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish KAITerminal.OrderAgent/KAITerminal.OrderAgent.csproj \
    -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "KAITerminal.OrderAgent.dll"]
```

- [ ] **Step 2: Verify Docker build (optional — needs Docker)**

```bash
cd backend && docker build -t kaiterminal/order-agent:latest \
    -f KAITerminal.OrderAgent/Dockerfile .
```

Expected: image built successfully

---

## Task 10: `KAITerminal.Api` — Wire OrderRouting + Admin Endpoints

**Files:**
- Modify: `backend/KAITerminal.Api/KAITerminal.Api.csproj`
- Modify: `backend/KAITerminal.Api/Program.cs`
- Create: `backend/KAITerminal.Api/Endpoints/AdminOrderAgentEndpoints.cs`

- [ ] **Step 1: Add project reference to Api csproj**

In `backend/KAITerminal.Api/KAITerminal.Api.csproj`, inside the existing `<ItemGroup>` with `<ProjectReference>` entries, add:

```xml
<ProjectReference Include="../KAITerminal.OrderRouting/KAITerminal.OrderRouting.csproj" />
```

- [ ] **Step 2: Register OrderRouting services in `Program.cs`**

In `backend/KAITerminal.Api/Program.cs`, add after the `builder.Services.AddSingleton<MasterDataService>();` line:

```csharp
// OrderRouting — routes order placement through per-user IP-bound agents when registered
builder.Services.AddHttpClient("OrderAgent");
builder.Services.AddSingleton<KAITerminal.OrderRouting.IOrderAgentRegistry,
                               KAITerminal.OrderRouting.OrderAgentRegistry>();
builder.Services.AddSingleton<KAITerminal.OrderRouting.IOrderAgentClient,
                               KAITerminal.OrderRouting.HttpOrderAgentClient>();
builder.Services.AddSingleton<KAITerminal.OrderRouting.IOrderRouter,
                               KAITerminal.OrderRouting.OrderRouter>();
```

- [ ] **Step 3: Load agents at startup in `Program.cs`**

After `await app.InitializeDatabaseAsync();` add:

```csharp
await app.Services
    .GetRequiredService<KAITerminal.OrderRouting.IOrderAgentRegistry>()
    .LoadAsync();
```

- [ ] **Step 4: Map admin endpoints in `Program.cs`**

After `app.MapAdminEndpoints();` add:

```csharp
app.MapAdminOrderAgentEndpoints();
```

- [ ] **Step 5: Create `AdminOrderAgentEndpoints.cs`**

```csharp
// backend/KAITerminal.Api/Endpoints/AdminOrderAgentEndpoints.cs
using KAITerminal.Infrastructure.Data;
using KAITerminal.OrderRouting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KAITerminal.Api.Endpoints;

internal static class AdminOrderAgentEndpoints
{
    internal static void MapAdminOrderAgentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/admin/order-agents").RequireAuthorization("AdminOnly");

        group.MapGet("/", async (AppDbContext db) =>
            Results.Ok(await db.UserOrderAgents.ToListAsync()));

        group.MapPost("/", async (
            [FromBody] UpsertAgentRequest req,
            AppDbContext db,
            IOrderAgentRegistry registry) =>
        {
            var existing = await db.UserOrderAgents.FindAsync(req.Username);
            if (existing is null)
            {
                db.UserOrderAgents.Add(new UserOrderAgent
                {
                    Username  = req.Username,
                    AgentUrl  = req.AgentUrl,
                    AgentKey  = req.AgentKey,
                    StaticIp  = req.StaticIp,
                    IsEnabled = true
                });
            }
            else
            {
                existing.AgentUrl = req.AgentUrl;
                existing.AgentKey = req.AgentKey;
                existing.StaticIp = req.StaticIp;
            }
            await db.SaveChangesAsync();
            registry.Upsert(req.Username, req.AgentUrl, req.AgentKey);
            return Results.Ok();
        });

        group.MapDelete("/{username}", async (
            string username,
            AppDbContext db,
            IOrderAgentRegistry registry) =>
        {
            var existing = await db.UserOrderAgents.FindAsync(username);
            if (existing is not null)
            {
                db.UserOrderAgents.Remove(existing);
                await db.SaveChangesAsync();
            }
            registry.Remove(username);
            return Results.Ok();
        });
    }

    internal sealed record UpsertAgentRequest(
        string Username,
        string AgentUrl,
        string AgentKey,
        string StaticIp);
}
```

- [ ] **Step 6: Verify build**

```bash
cd backend && dotnet build KAITerminal.Api/KAITerminal.Api.csproj
```

Expected: `Build succeeded`

---

## Task 11: `KAITerminal.Api` — Update Order Endpoints

**Files:**
- Modify: `backend/KAITerminal.Api/Endpoints/UpstoxOrderEndpoints.cs`
- Modify: `backend/KAITerminal.Api/Endpoints/ZerodhaOrderEndpoints.cs`

- [ ] **Step 1: Update `UpstoxOrderEndpoints.cs`**

Replace the full file content:

```csharp
// backend/KAITerminal.Api/Endpoints/UpstoxOrderEndpoints.cs
using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.OrderRouting;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

internal static class UpstoxOrderEndpoints
{
    internal static void Map(RouteGroupBuilder group, ILogger logger)
    {
        group.MapGet("/orders", async (UpstoxClient upstox, CancellationToken ct) =>
            Results.Ok((await upstox.Orders.GetAllOrdersAsync(ct)).Select(o => o.ToResponse())));

        group.MapPost("/orders/v3", async (
            [FromBody] PlaceOrderRequest request,
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var token    = UpstoxTokenContext.Current!;
            var result   = await orderRouter.PlaceUpstoxOrderAsync(username, token, request, ct);
            logger.LogInformation(
                "Order placed — {User} — qty={Qty} {Symbol} {Side} @ {Price} — ids=[{OrderIds}] latency={Latency}ms",
                username, request.Quantity, request.InstrumentToken, request.TransactionType,
                request.Price, string.Join(",", result.OrderIds), result.Latency);
            return Results.Ok(result);
        });

        group.MapPost("/orders/cancel-all", async (
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var token    = UpstoxTokenContext.Current!;
            var ids      = await orderRouter.CancelAllUpstoxOrdersAsync(username, token, ct);
            logger.LogInformation(
                "Cancel all pending orders — {User} — {Count} order(s) cancelled",
                username, ids.Count);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapDelete("/orders/{orderId}/v3", async (
            string orderId,
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var token    = UpstoxTokenContext.Current!;
            var (id, latency) = await orderRouter.CancelUpstoxOrderAsync(username, token, orderId, ct);
            logger.LogInformation(
                "Order cancelled — {User} — {OrderId} — latency {Latency}ms",
                username, id, latency);
            return Results.Ok(new { OrderId = id, Latency = latency });
        });

        group.MapPost("/orders/by-price", async (
            [FromBody] ByPriceOrderRequest request,
            ByPriceOrderService byPriceSvc,
            UpstoxClient upstox,
            ClaimsPrincipal user,
            CancellationToken ct) =>
            await byPriceSvc.PlaceUpstoxAsync(
                request, upstox, user.GetEmail() ?? "unknown", logger, ct));
    }
}
```

- [ ] **Step 2: Update `ZerodhaOrderEndpoints.cs`**

Replace the full file content:

```csharp
// backend/KAITerminal.Api/Endpoints/ZerodhaOrderEndpoints.cs
using System.Security.Claims;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Mapping;
using KAITerminal.Api.Models;
using KAITerminal.Api.Services;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.OrderRouting;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Api.Endpoints;

internal static class ZerodhaOrderEndpoints
{
    internal static void Map(RouteGroupBuilder group, ILogger logger)
    {
        group.MapGet("/orders", async (ZerodhaClient zerodha, CancellationToken ct) =>
            Results.Ok((await zerodha.Orders.GetAllOrdersAsync(ct)).Select(o => o.ToResponse())));

        group.MapPost("/orders/v3", async (
            [FromBody] ZerodhaOrderRequest request,
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var creds    = ZerodhaTokenContext.Current!.Value;
            var brokerRequest = new BrokerOrderRequest(
                request.InstrumentToken, request.Quantity, request.TransactionType,
                request.Product, request.OrderType, request.Price, request.TriggerPrice,
                request.Exchange);
            var orderId = await orderRouter.PlaceZerodhaOrderAsync(
                username, creds.AccessToken, creds.ApiKey, brokerRequest, ct);
            logger.LogInformation(
                "Order placed — {User} — {Token} qty={Qty} {Side} — order {OrderId}",
                username, request.InstrumentToken, request.Quantity, request.TransactionType, orderId);
            return Results.Ok(new { orderId });
        });

        group.MapPost("/orders/cancel-all", async (
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var creds    = ZerodhaTokenContext.Current!.Value;
            var ids      = await orderRouter.CancelAllZerodhaOrdersAsync(
                username, creds.AccessToken, creds.ApiKey, ct);
            logger.LogInformation(
                "Cancel all pending orders — {User} — {Count} order(s) cancelled",
                username, ids.Count);
            return Results.Ok(new { OrderIds = ids });
        });

        group.MapDelete("/orders/{orderId}", async (
            string orderId,
            IOrderRouter orderRouter,
            ClaimsPrincipal user,
            CancellationToken ct) =>
        {
            var username = user.GetEmail() ?? "unknown";
            var creds    = ZerodhaTokenContext.Current!.Value;
            var id       = await orderRouter.CancelZerodhaOrderAsync(
                username, creds.AccessToken, creds.ApiKey, orderId, ct);
            logger.LogInformation(
                "Order cancelled — {User} — {OrderId}", username, id);
            return Results.Ok(new { OrderId = id });
        });

        group.MapPost("/orders/by-price", async (
            [FromBody] ByPriceOrderRequest request,
            ByPriceOrderService byPriceSvc,
            ZerodhaClient zerodha,
            IZerodhaInstrumentService zerodhaInstruments,
            ClaimsPrincipal user,
            CancellationToken ct) =>
            await byPriceSvc.PlaceZerodhaAsync(
                request, zerodha, zerodhaInstruments,
                user.GetEmail() ?? "unknown", logger, ct));
    }

    private sealed record ZerodhaOrderRequest(
        string   InstrumentToken,
        int      Quantity,
        string   TransactionType,
        string   Product,
        string   OrderType,
        decimal? Price        = null,
        decimal? TriggerPrice = null,
        string?  Exchange     = null);
}
```

- [ ] **Step 3: Verify build**

```bash
cd backend && dotnet build KAITerminal.Api/KAITerminal.Api.csproj
```

Expected: `Build succeeded`

---

## Task 12: `KAITerminal.Api` — Update `ByPriceOrderService` + `PositionShiftService`

**Files:**
- Modify: `backend/KAITerminal.Api/Services/ByPriceOrderService.cs`
- Modify: `backend/KAITerminal.Api/Services/PositionShiftService.cs`

- [ ] **Step 1: Update `ByPriceOrderService.cs`**

Replace the full file content:

```csharp
// backend/KAITerminal.Api/Services/ByPriceOrderService.cs
using KAITerminal.Api.Models;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.OrderRouting;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Api.Services;

internal sealed class ByPriceOrderService(OptionStrikeService strikeSvc)
{
    public async Task<IResult> PlaceUpstoxAsync(
        ByPriceOrderRequest request, UpstoxClient upstox,
        string email, ILogger logger, CancellationToken ct,
        IOrderRouter? orderRouter = null)
    {
        var key = await strikeSvc.FindByPriceAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.TargetPremium, ct);

        if (key is null)
            return Results.Problem("No matching strike found in option chain.");

        var txn     = request.TransactionType == "Buy" ? TransactionType.Buy : TransactionType.Sell;
        var product = UpstoxProductMap.ToEnum(request.Product);
        var orderRequest = new PlaceOrderRequest
        {
            InstrumentToken = key,
            Quantity        = request.Qty,
            TransactionType = txn,
            Product         = product,
            Slice           = true,
        };

        if (orderRouter is not null)
            await orderRouter.PlaceUpstoxOrderAsync(email, UpstoxTokenContext.Current!, orderRequest, ct);
        else
            await upstox.Hft.PlaceOrderV3Async(orderRequest);

        logger.LogInformation(
            "By-price order — {User} — {Underlying} {Expiry} {Type} qty={Qty} {Side} target=₹{Premium} → {Key}",
            email, request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.Qty, request.TransactionType, request.TargetPremium, key);

        return Results.Ok(new { instrumentKey = key });
    }

    public async Task<IResult> PlaceZerodhaAsync(
        ByPriceOrderRequest request, ZerodhaClient zerodha,
        IZerodhaInstrumentService zerodhaInstruments,
        string email, ILogger logger, CancellationToken ct,
        IOrderRouter? orderRouter = null)
    {
        var upstoxKey = await strikeSvc.FindByPriceAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.TargetPremium, ct);

        if (upstoxKey is null)
            return Results.Problem("No matching strike found in option chain.");

        var (match, exchangeToken) = await ZerodhaContractResolver.ResolveAsync(upstoxKey, zerodhaInstruments, ct);
        if (match is null)
            return Results.Problem($"Zerodha trading symbol not found for exchange token {exchangeToken}.");

        var brokerRequest = new BrokerOrderRequest(
            match.TradingSymbol, request.Qty, request.TransactionType,
            request.Product, "MARKET", Exchange: match.Exchange);

        if (orderRouter is not null)
        {
            var creds = ZerodhaTokenContext.Current!.Value;
            await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, brokerRequest, ct);
        }
        else
            await zerodha.Orders.PlaceOrderAsync(brokerRequest, ct);

        logger.LogInformation(
            "By-price order — {User} — {Underlying} {Expiry} {Type} qty={Qty} {Side} target=₹{Premium} → {Symbol} ({Exchange})",
            email, request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.Qty, request.TransactionType, request.TargetPremium, match.TradingSymbol, match.Exchange);

        return Results.Ok(new { instrumentKey = upstoxKey });
    }
}
```

- [ ] **Step 2: Update the `by-price` endpoint calls in `UpstoxOrderEndpoints` to pass `IOrderRouter`**

In `backend/KAITerminal.Api/Endpoints/UpstoxOrderEndpoints.cs`, update the `by-price` handler:

```csharp
group.MapPost("/orders/by-price", async (
    [FromBody] ByPriceOrderRequest request,
    ByPriceOrderService byPriceSvc,
    IOrderRouter orderRouter,
    UpstoxClient upstox,
    ClaimsPrincipal user,
    CancellationToken ct) =>
    await byPriceSvc.PlaceUpstoxAsync(
        request, upstox, user.GetEmail() ?? "unknown", logger, ct, orderRouter));
```

In `backend/KAITerminal.Api/Endpoints/ZerodhaOrderEndpoints.cs`, update the `by-price` handler:

```csharp
group.MapPost("/orders/by-price", async (
    [FromBody] ByPriceOrderRequest request,
    ByPriceOrderService byPriceSvc,
    IOrderRouter orderRouter,
    ZerodhaClient zerodha,
    IZerodhaInstrumentService zerodhaInstruments,
    ClaimsPrincipal user,
    CancellationToken ct) =>
    await byPriceSvc.PlaceZerodhaAsync(
        request, zerodha, zerodhaInstruments,
        user.GetEmail() ?? "unknown", logger, ct, orderRouter));
```

- [ ] **Step 3: Update `PositionShiftService.cs`**

Replace the full file content:

```csharp
// backend/KAITerminal.Api/Services/PositionShiftService.cs
using KAITerminal.Api.Models;
using KAITerminal.Broker;
using KAITerminal.Contracts.Options;
using KAITerminal.Contracts.Domain;
using KAITerminal.MarketData.Services;
using KAITerminal.OrderRouting;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;
using KAITerminal.Zerodha;
using KAITerminal.Zerodha.Services;

namespace KAITerminal.Api.Services;

internal sealed class PositionShiftService(OptionStrikeService strikeSvc)
{
    private const int FillTimeoutSeconds = 20;

    public async Task<IResult> ShiftUpstoxAsync(
        ShiftPositionRequest request, UpstoxClient upstox,
        IOrderRouter orderRouter, string email, ILogger logger, CancellationToken ct)
    {
        bool isCe      = OptionInstrumentType.IsCe(request.InstrumentType);
        var  strikeGap = ComputeStrikeGap(isCe, request.Direction, request.StrikeGap);
        var  targetKey = await strikeSvc.FindByStrikeGapAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.CurrentStrike, strikeGap, ct);

        if (targetKey is null)
            return Results.Problem("No matching strike found in option chain.");

        var closeTxn = request.IsShort ? TransactionType.Buy  : TransactionType.Sell;
        var openTxn  = request.IsShort ? TransactionType.Sell : TransactionType.Buy;
        var product  = UpstoxProductMap.ToEnum(request.Product);
        var token    = UpstoxTokenContext.Current!;

        var closeOrder = new PlaceOrderRequest
        {
            InstrumentToken = request.InstrumentToken,
            Quantity        = request.Qty,
            TransactionType = closeTxn,
            Product         = product,
            Slice           = true,
        };
        var openOrder = new PlaceOrderRequest
        {
            InstrumentToken = targetKey,
            Quantity        = request.Qty,
            TransactionType = openTxn,
            Product         = product,
            Slice           = true,
        };

        string? warning = null;
        if (request.IsShort)
        {
            var closeResult  = await orderRouter.PlaceUpstoxOrderAsync(email, token, closeOrder, ct);
            var closeOrderIds = string.Join(",", closeResult.OrderIds);
            var filled = await WaitForFillAsync(upstox.Orders, closeOrderIds, FillTimeoutSeconds, logger, CancellationToken.None);
            if (!filled)
                warning = "Close order fill not confirmed within 20s — open leg placed anyway. Verify your positions.";
            try
            {
                await orderRouter.PlaceUpstoxOrderAsync(email, token, openOrder, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "PARTIAL SHIFT — {User} — close {CloseToken} succeeded but open {OpenToken} failed.",
                    email, request.InstrumentToken, targetKey);
                return Results.Problem(
                    $"Close order placed but open order failed: {ex.Message}. Manual intervention may be required.");
            }
        }
        else
        {
            await orderRouter.PlaceUpstoxOrderAsync(email, token, openOrder, ct);
            try
            {
                await orderRouter.PlaceUpstoxOrderAsync(email, token, closeOrder, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "PARTIAL SHIFT — {User} — open {OpenToken} succeeded but close {CloseToken} failed.",
                    email, targetKey, request.InstrumentToken);
                return Results.Problem(
                    $"Open order placed but close order failed: {ex.Message}. Manual intervention may be required.");
            }
        }

        logger.LogInformation(
            "Shift {Direction} — {User} — close {CloseToken} qty={Qty} | open {OpenToken} product={Product}",
            request.Direction, email, request.InstrumentToken, request.Qty, targetKey, request.Product);

        return Results.Ok(new { targetToken = targetKey, warning });
    }

    public async Task<IResult> ShiftZerodhaAsync(
        ShiftPositionRequest request, ZerodhaClient zerodha,
        IZerodhaInstrumentService zerodhaInstruments,
        IOrderRouter orderRouter, string email, ILogger logger, CancellationToken ct)
    {
        bool isCe      = OptionInstrumentType.IsCe(request.InstrumentType);
        var  strikeGap = ComputeStrikeGap(isCe, request.Direction, request.StrikeGap);
        var  upstoxKey = await strikeSvc.FindByStrikeGapAsync(
            request.UnderlyingKey, request.Expiry, request.InstrumentType,
            request.CurrentStrike, strikeGap, ct);

        if (upstoxKey is null)
            return Results.Problem("No matching strike found in option chain.");

        var (match, exchangeToken) = await ZerodhaContractResolver.ResolveAsync(upstoxKey, zerodhaInstruments, ct);
        if (match is null)
            return Results.Problem($"Zerodha trading symbol not found for exchange token {exchangeToken}.");

        var closeTxn   = request.IsShort ? "Buy"  : "Sell";
        var openTxn    = request.IsShort ? "Sell" : "Buy";
        var creds      = ZerodhaTokenContext.Current!.Value;
        var closeOrder = new BrokerOrderRequest(request.InstrumentToken, request.Qty, closeTxn, request.Product, "MARKET", Exchange: request.Exchange);
        var openOrder  = new BrokerOrderRequest(match.TradingSymbol, request.Qty, openTxn, request.Product, "MARKET", Exchange: match.Exchange);

        string? warning = null;
        if (request.IsShort)
        {
            var closeOrderId = await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, closeOrder, ct);
            var filled = await WaitForFillAsync(zerodha.Orders, closeOrderId, FillTimeoutSeconds, logger, CancellationToken.None);
            if (!filled)
                warning = "Close order fill not confirmed within 20s — open leg placed anyway. Verify your positions.";
            try
            {
                await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, openOrder, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "PARTIAL SHIFT — {User} — close {CloseSymbol} succeeded but open {OpenSymbol} failed.",
                    email, request.InstrumentToken, match.TradingSymbol);
                return Results.Problem(
                    $"Close order placed but open order failed: {ex.Message}. Manual intervention may be required.");
            }
        }
        else
        {
            await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, openOrder, ct);
            try
            {
                await orderRouter.PlaceZerodhaOrderAsync(email, creds.AccessToken, creds.ApiKey, closeOrder, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "PARTIAL SHIFT — {User} — open {OpenSymbol} succeeded but close {CloseSymbol} failed.",
                    email, match.TradingSymbol, request.InstrumentToken);
                return Results.Problem(
                    $"Open order placed but close order failed: {ex.Message}. Manual intervention may be required.");
            }
        }

        logger.LogInformation(
            "Shift {Direction} — {User} — close {CloseSymbol} ({CloseExchange}) qty={Qty} | open {OpenSymbol} ({OpenExchange}) product={Product}",
            request.Direction, email, request.InstrumentToken, request.Exchange, request.Qty,
            match.TradingSymbol, match.Exchange, request.Product);

        return Results.Ok(new { targetToken = $"{match.Exchange}|{match.TradingSymbol}", warning });
    }

    private static async Task<bool> WaitForFillAsync(
        IBrokerOrderService orders, string orderIds, int timeoutSeconds,
        ILogger logger, CancellationToken ct)
    {
        var ids      = orderIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.Ordinal);
        var deadline = DateTimeOffset.UtcNow.AddSeconds(timeoutSeconds);

        while (DateTimeOffset.UtcNow < deadline)
        {
            var allOrders = await orders.GetAllOrdersAsync(ct);
            var matched   = allOrders.Where(o => ids.Contains(o.OrderId)).ToList();

            var rejected = matched.FirstOrDefault(o => o.Status.Equals("rejected", StringComparison.OrdinalIgnoreCase));
            if (rejected is not null)
                throw new InvalidOperationException($"Close order {rejected.OrderId} was rejected: {rejected.StatusMessage}");

            if (matched.Count > 0 && matched.All(o => o.Status.Equals("complete", StringComparison.OrdinalIgnoreCase)))
                return true;

            await Task.Delay(500, ct);
        }

        logger.LogWarning(
            "Shift: timed out after {Timeout}s waiting for close fill — orderIds={OrderIds}",
            timeoutSeconds, orderIds);
        return false;
    }

    private static int ComputeStrikeGap(bool isCe, string direction, int gap) =>
        isCe ? (direction == "down" ? gap : -gap)
             : (direction == "up"   ? gap : -gap);
}
```

- [ ] **Step 4: Update the shift endpoint callers to pass `IOrderRouter`**

Find `PositionShiftService` usages in the Api endpoints and add `IOrderRouter orderRouter` parameter, passing it through. Search for `ShiftUpstoxAsync` and `ShiftZerodhaAsync` calls in `backend/KAITerminal.Api/Endpoints/` and add `IOrderRouter` to each endpoint's parameter list and method call.

- [ ] **Step 5: Verify build**

```bash
cd backend && dotnet build KAITerminal.Api/KAITerminal.Api.csproj
```

Expected: `Build succeeded`

---

## Task 13: `KAITerminal.Worker` — `OrderRoutingBrokerClient`

**Files:**
- Modify: `backend/KAITerminal.Worker/KAITerminal.Worker.csproj`
- Create: `backend/KAITerminal.Worker/OrderRouting/OrderRoutingBrokerClient.cs`

- [ ] **Step 1: Add OrderRouting reference to Worker csproj**

In `backend/KAITerminal.Worker/KAITerminal.Worker.csproj`, inside the `<ItemGroup>` with project references, add:

```xml
<ProjectReference Include="..\KAITerminal.OrderRouting\KAITerminal.OrderRouting.csproj" />
```

- [ ] **Step 2: Create `OrderRoutingBrokerClient`**

```csharp
// backend/KAITerminal.Worker/OrderRouting/OrderRoutingBrokerClient.cs
using KAITerminal.Broker;
using KAITerminal.Contracts;
using KAITerminal.Contracts.Domain;
using KAITerminal.OrderRouting;
using KAITerminal.Upstox;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Models.Requests;

namespace KAITerminal.Worker.OrderRouting;

/// <summary>
/// Decorates IBrokerClient to route PlaceOrderAsync / CancelOrderAsync /
/// CancelAllPendingOrdersAsync through the per-user OrderAgent when registered.
/// All other methods delegate unchanged to the inner client.
/// </summary>
internal sealed class OrderRoutingBrokerClient : IBrokerClient
{
    private readonly IBrokerClient _inner;
    private readonly string        _username;
    private readonly string        _brokerType;
    private readonly string        _accessToken;
    private readonly string?       _apiKey;
    private readonly IOrderRouter  _router;

    public OrderRoutingBrokerClient(
        IBrokerClient inner,
        string        username,
        string        brokerType,
        string        accessToken,
        string?       apiKey,
        IOrderRouter  router)
    {
        _inner       = inner;
        _username    = username;
        _brokerType  = brokerType;
        _accessToken = accessToken;
        _apiKey      = apiKey;
        _router      = router;
    }

    public string BrokerType => _inner.BrokerType;
    public IDisposable UseToken() => _inner.UseToken();

    public async Task<string> PlaceOrderAsync(BrokerOrderRequest request, CancellationToken ct = default)
    {
        if (_brokerType.Equals(BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
        {
            var txType    = request.TransactionType.Equals("BUY", StringComparison.OrdinalIgnoreCase)
                ? TransactionType.Buy : TransactionType.Sell;
            var orderType = request.OrderType.Equals("LIMIT", StringComparison.OrdinalIgnoreCase)
                ? OrderType.Limit : OrderType.Market;
            var product   = UpstoxProductMap.ToEnum(request.Product);

            var upstoxRequest = new PlaceOrderRequest
            {
                InstrumentToken = request.InstrumentToken,
                Quantity        = request.Quantity,
                TransactionType = txType,
                OrderType       = orderType,
                Product         = product,
                Price           = request.Price ?? 0,
                Tag             = request.Tag,
                Slice           = true,
            };
            var result = await _router.PlaceUpstoxOrderAsync(_username, _accessToken, upstoxRequest, ct);
            return string.Join(",", result.OrderIds);
        }

        return await _router.PlaceZerodhaOrderAsync(_username, _accessToken, _apiKey!, request, ct);
    }

    public async Task<string> CancelOrderAsync(string orderId, CancellationToken ct = default)
    {
        if (_brokerType.Equals(BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
        {
            var (id, _) = await _router.CancelUpstoxOrderAsync(_username, _accessToken, orderId, ct);
            return id;
        }
        return await _router.CancelZerodhaOrderAsync(_username, _accessToken, _apiKey!, orderId, ct);
    }

    public async Task<IReadOnlyList<string>> CancelAllPendingOrdersAsync(CancellationToken ct = default)
    {
        if (_brokerType.Equals(BrokerNames.Upstox, StringComparison.OrdinalIgnoreCase))
            return await _router.CancelAllUpstoxOrdersAsync(_username, _accessToken, ct);

        return await _router.CancelAllZerodhaOrdersAsync(_username, _accessToken, _apiKey!, ct);
    }

    // All remaining IBrokerClient members delegate to _inner unchanged
    public Task<IReadOnlyList<BrokerPosition>> GetAllPositionsAsync(CancellationToken ct = default)
        => _inner.GetAllPositionsAsync(ct);

    public Task<decimal> GetTotalMtmAsync(CancellationToken ct = default)
        => _inner.GetTotalMtmAsync(ct);

    public Task ExitAllPositionsAsync(IReadOnlyCollection<string>? exchanges = null, CancellationToken ct = default)
        => _inner.ExitAllPositionsAsync(exchanges, ct);

    public Task ExitPositionAsync(string instrumentToken, string product, CancellationToken ct = default)
        => _inner.ExitPositionAsync(instrumentToken, product, ct);

    public Task<IReadOnlyList<BrokerOrder>> GetAllOrdersAsync(CancellationToken ct = default)
        => _inner.GetAllOrdersAsync(ct);

    public Task<BrokerFunds> GetFundsAsync(CancellationToken ct = default)
        => _inner.GetFundsAsync(ct);
}
```

- [ ] **Step 3: Verify build**

```bash
cd backend && dotnet build KAITerminal.Worker/KAITerminal.Worker.csproj
```

Expected: `Build succeeded`

---

## Task 14: `KAITerminal.Worker` — Wire into `StreamingRiskWorker` + `Program.cs`

**Files:**
- Modify: `backend/KAITerminal.RiskEngine/Workers/StreamingRiskWorker.cs`
- Modify: `backend/KAITerminal.Worker/Program.cs`

- [ ] **Step 1: Add `IOrderAgentRegistry` and `IOrderRouter` to `StreamingRiskWorker` constructor**

In `backend/KAITerminal.RiskEngine/Workers/StreamingRiskWorker.cs`, find the constructor and private fields. Add two new fields after the existing `IBrokerClientFactory` field:

```csharp
private readonly IOrderAgentRegistry? _orderAgentRegistry;
private readonly IOrderRouter?        _orderRouter;
```

Add the parameters to the constructor:

```csharp
IOrderAgentRegistry? orderAgentRegistry = null,
IOrderRouter?        orderRouter        = null,
```

Assign in the constructor body:

```csharp
_orderAgentRegistry = orderAgentRegistry;
_orderRouter        = orderRouter;
```

- [ ] **Step 2: Wrap broker with decorator after creation**

In `StreamingRiskWorker.cs`, find the line:

```csharp
var broker = _brokerFactory.Create(user.BrokerType, user.AccessToken, user.ApiKey);
```

Replace with:

```csharp
var broker = _brokerFactory.Create(user.BrokerType, user.AccessToken, user.ApiKey);
if (_orderAgentRegistry is not null && _orderRouter is not null
    && _orderAgentRegistry.GetAgent(user.UserId) is not null)
{
    broker = new KAITerminal.Worker.OrderRouting.OrderRoutingBrokerClient(
        broker, user.UserId, user.BrokerType,
        user.AccessToken, user.ApiKey, _orderRouter);
}
```

- [ ] **Step 3: Register OrderRouting services in `Worker/Program.cs`**

In `backend/KAITerminal.Worker/Program.cs`, add after `builder.Services.AddSingleton<IRiskEventNotifier, HttpRiskEventNotifier>();`:

```csharp
// OrderRouting — per-user IP-bound order agent support
builder.Services.AddHttpClient("OrderAgent");
builder.Services.AddSingleton<KAITerminal.OrderRouting.IOrderAgentRegistry,
                               KAITerminal.OrderRouting.OrderAgentRegistry>();
builder.Services.AddSingleton<KAITerminal.OrderRouting.IOrderAgentClient,
                               KAITerminal.OrderRouting.HttpOrderAgentClient>();
builder.Services.AddSingleton<KAITerminal.OrderRouting.IOrderRouter,
                               KAITerminal.OrderRouting.OrderRouter>();
```

Add load call after the existing `var app = builder.Build();` equivalent (after `host.Build()` / before `host.Run()`):

```csharp
await host.Services
    .GetRequiredService<KAITerminal.OrderRouting.IOrderAgentRegistry>()
    .LoadAsync();
```

- [ ] **Step 4: Verify full solution build**

```bash
cd backend && dotnet build
```

Expected: `Build succeeded. 0 Error(s)`

---

## Task 15: Docker Compose

**Files:**
- Create: `docker-compose.yml` (at repo root or `backend/` — wherever you run Docker from)

- [ ] **Step 1: Create base `docker-compose.yml`**

```yaml
# docker-compose.yml
# One service per user. Each binds outbound sockets to BIND_IP (must be assigned to host NIC).
# Agents listen on loopback only — never exposed to the internet.
# Secrets live in .env (never committed).

services:
  # ── Template — copy and rename per user ──────────────────────────────────────
  # order-agent-<username>:
  #   image: kaiterminal/order-agent:latest
  #   network_mode: host
  #   restart: unless-stopped
  #   environment:
  #     ASPNETCORE_URLS: http://127.0.0.1:<PORT>
  #     BIND_IP: <STATIC_IP>
  #     AGENT_KEY: ${AGENT_KEY_<USERNAME>}
  #     Upstox__HftBaseUrl: https://api-hft.upstox.com
  #     Upstox__ApiBaseUrl: https://api.upstox.com
  #     Zerodha__ApiBaseUrl: https://api.kite.trade
  # ─────────────────────────────────────────────────────────────────────────────
```

- [ ] **Step 2: Add first user (example)**

When provisioning a real user (e.g. alice@gmail.com), add to `docker-compose.yml`:

```yaml
services:
  order-agent-alice:
    image: kaiterminal/order-agent:latest
    network_mode: host
    restart: unless-stopped
    environment:
      ASPNETCORE_URLS: http://127.0.0.1:5101
      BIND_IP: 1.2.3.101
      AGENT_KEY: ${AGENT_KEY_ALICE}
      Upstox__HftBaseUrl: https://api-hft.upstox.com
      Upstox__ApiBaseUrl: https://api.upstox.com
      Zerodha__ApiBaseUrl: https://api.kite.trade
```

Create `.env` (never commit):

```
AGENT_KEY_ALICE=<generate with: openssl rand -hex 32>
```

- [ ] **Step 3: Add IP to host NIC and start container**

```bash
# Assign the static IP to the server's NIC (make permanent in /etc/network/interfaces)
sudo ip addr add 1.2.3.101/32 dev eth0

# Build the agent image
cd backend && docker build -t kaiterminal/order-agent:latest \
    -f KAITerminal.OrderAgent/Dockerfile .

# Start the agent
docker compose up -d order-agent-alice
docker compose logs order-agent-alice
```

Expected log: `Now listening on: http://127.0.0.1:5101`

- [ ] **Step 4: Register in Api**

```bash
curl -s -X POST https://your-server/api/admin/order-agents \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice@gmail.com",
    "agentUrl": "http://127.0.0.1:5101",
    "agentKey": "<same key from .env>",
    "staticIp": "1.2.3.101"
  }'
```

Expected: `200 OK`

- [ ] **Step 5: Verify order routing**

Place a test order through alice's account in the UI. Check agent logs to confirm the order hit the agent:

```bash
docker compose logs order-agent-alice --tail=20
```

Expected: log line showing `POST /upstox/orders` or `POST /zerodha/orders` with 200 status.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in |
|-----------------|-----------|
| One container per user, both brokers | Tasks 6–9, 15 |
| IP binding via SocketsHttpHandler | Task 6 |
| Tokens in headers (not body) | Tasks 4, 7, 8 |
| UpstoxOrderRequest / ZerodhaOrderRequest contract models | Task 2 |
| IOrderAgentRegistry (ConcurrentDictionary, no TTL) | Task 3 |
| IOrderAgentClient (HTTP over loopback) | Task 4 |
| IOrderRouter (agent or direct fallback) | Task 5 |
| DB table UserOrderAgents | Task 1 |
| Admin CRUD endpoints | Task 10 |
| UpstoxOrderEndpoints uses IOrderRouter | Task 11 |
| ZerodhaOrderEndpoints uses IOrderRouter | Task 11 |
| ByPriceOrderService uses IOrderRouter | Task 12 |
| PositionShiftService uses IOrderRouter | Task 12 |
| OrderRoutingBrokerClient decorator | Task 13 |
| StreamingRiskWorker wraps broker | Task 14 |
| Worker Program.cs registers services | Task 14 |
| Api Program.cs registers services + loads registry | Task 10 |
| Dockerfile | Task 9 |
| Docker Compose | Task 15 |
| Hard fail when agent unreachable (no silent fallback) | `EnsureSuccessStatusCode()` in Task 4 |
| X-Agent-Key auth on every agent request | Tasks 4, 6 |

**No gaps found.**
