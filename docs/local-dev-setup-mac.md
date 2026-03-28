---
tags:
  - setup
  - development
  - macos
  - local-dev
aliases:
  - Local Dev Setup
  - Mac Setup
related:
  - "[[production-deployment]]"
  - "[[deployment-concepts]]"
  - "[[README]]"
---

# Local Dev Environment Setup — macOS

This guide sets up a complete local development environment using Homebrew.

---

## Prerequisites

### 1. Install Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install .NET 10 SDK

```bash
brew install --cask dotnet-sdk
```

Verify:
```bash
dotnet --version   # should be 10.x
```

### 3. Install Node.js

```bash
brew install node
```

Verify:
```bash
node --version   # 20+
npm --version
```

### 4. Install Docker

Docker is required to run Seq (structured log viewer).

```bash
brew install --cask docker
```

Open the Docker app from Applications to start the Docker daemon. Verify:
```bash
docker --version
```

### 5. Install Redis

```bash
brew install redis
```

Start Redis (and auto-start on login):
```bash
brew services start redis
```

Verify:
```bash
redis-cli ping   # should return PONG
```

---

## Database

### 6. Install PostgreSQL

```bash
brew install postgresql@18
```

Start PostgreSQL (and auto-start on login):
```bash
brew services start postgresql@18
```

Create the database and user (Homebrew uses your macOS login as the PostgreSQL superuser, so no `-U` flag needed):
```bash
psql -d postgres -c "CREATE USER kaiuser WITH PASSWORD 'kaipassword';"
psql -d postgres -c "CREATE DATABASE kaiterminal OWNER kaiuser;"
psql -d kaiterminal -c "GRANT ALL ON SCHEMA public TO kaiuser;"
```

> [!NOTE]
> Making `kaiuser` the database **owner** avoids `permission denied for schema public` errors — a PostgreSQL 15+ behaviour change that affects `EnsureCreatedAsync`.

Verify the connection:
```bash
psql -U kaiuser -d kaiterminal -c "SELECT version();"
```

Local connection string (use this in user-secrets):
```
Host=localhost;Database=kaiterminal;Username=kaiuser;Password=kaipassword
```

> [!NOTE]
> The app uses `EnsureCreatedAsync` on startup — tables are created automatically on first run.

---

## GUI Tools

### TablePlus — PostgreSQL (and Redis)

TablePlus is the best macOS GUI for PostgreSQL. Clean, fast, native app. Also supports Redis, MySQL, and more.

```bash
brew install --cask tableplus
```

Connect to local PostgreSQL:
- Host: `127.0.0.1`
- Port: `5432`
- User: `kaiuser`
- Password: `kaipassword`
- Database: `kaiterminal`

> [!TIP]
> TablePlus can also connect to Neon — use the Neon connection string with SSL mode set to `Require`.

### Seq — Structured Log Viewer

Seq provides a searchable web UI for all structured logs from the Api and Worker. It runs as a Docker container — no separate install needed beyond Docker.

Seq 2025+ requires either a password or explicit no-auth flag on first run. For local dev, disable auth:

```bash
docker run -d --name seq \
  -p 5341:5341 -p 8080:80 \
  -e ACCEPT_EULA=Y \
  -e SEQ_FIRSTRUN_NOAUTHENTICATION=true \
  -v "$HOME/.seq-data:/data" \
  datalust/seq:latest
```

Seq UI at: `http://localhost:8080`

To start/stop:
```bash
docker start seq
docker stop seq
```

Both the Api and Worker send structured logs to `http://localhost:5341` automatically. If Seq is not running, they fall back to console-only logging without errors.

### RedisInsight — Redis

RedisInsight is the official Redis GUI from Redis Ltd. Browse keys, run CLI commands, inspect pub/sub, and monitor memory — all in one app.

```bash
brew install --cask redisinsight
```

Connect to local Redis:
- Host: `127.0.0.1`
- Port: `6379`
- No password (default local setup)

Useful views for this project:
- **Browser** — inspect `appsetting:*` keys, SignalR backplane keys
- **Pub/Sub** — subscribe to `ltp:feed` to watch live LTP ticks, or `ltp:sub-req` to watch subscription requests from the API
- **CLI** — run `KEYS appsetting:*`, `GET appsetting:upstox_analytics_token`, `FLUSHALL`

---

## Clone & Configure

```bash
git clone git@github.com:suvrajitray/kai-terminal.git
cd kai-terminal
```

### Backend secrets

Secrets are stored with `dotnet user-secrets` — never in `appsettings.json`.

#### KAITerminal.Api

```bash
cd backend/KAITerminal.Api

dotnet user-secrets set "Jwt:Key" "<random-256-bit-secret>"
dotnet user-secrets set "GoogleAuth:ClientId" "<google-oauth-client-id>"
dotnet user-secrets set "GoogleAuth:ClientSecret" "<google-oauth-client-secret>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=kaiterminal;Username=kaiuser;Password=kaipassword"
dotnet user-secrets set "Api:InternalKey" "<any-uuid>"
```

#### KAITerminal.Worker

```bash
cd backend/KAITerminal.Worker

dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=kaiterminal;Username=kaiuser;Password=kaipassword"
dotnet user-secrets set "Api:InternalKey" "<same-uuid-as-api>"
dotnet user-secrets set "Api:BaseUrl" "https://localhost:5001"
```

> [!IMPORTANT]
> `Api:InternalKey` must be **identical** in both Api and Worker — it authenticates the Worker→Api risk event webhook.
>
> `ConnectionStrings:Redis` defaults to `localhost:6379` in both `appsettings.json` files — no user-secret needed for local dev.

#### Optional: AI Signals (KAITerminal.Api)

```bash
cd backend/KAITerminal.Api

dotnet user-secrets set "AiSentiment:OpenAiApiKey"  "sk-..."
dotnet user-secrets set "AiSentiment:GrokApiKey"    "xai-..."
dotnet user-secrets set "AiSentiment:GeminiApiKey"  "AIza..."
dotnet user-secrets set "AiSentiment:ClaudeApiKey"  "sk-ant-..."
```

### Frontend

The `.env` file is already committed with safe defaults. No changes needed for local dev — it points to `https://localhost:5001` by default.

---

## Manual DB Steps

The app auto-creates tables on first run via `EnsureCreatedAsync`. If you are upgrading an existing database that was created before a new table was added, run these manually:

```sql
-- AppSettings table (analytics token storage)
CREATE TABLE IF NOT EXISTS "AppSettings" (
  "Key"       text                     PRIMARY KEY,
  "Value"     text                     NOT NULL,
  "UpdatedAt" timestamp with time zone NOT NULL
);

-- UserRiskConfigs unique index (if upgrading from single-broker schema)
DROP INDEX IF EXISTS "ix_userriskconfigs_username";
CREATE UNIQUE INDEX IF NOT EXISTS "ix_userriskconfigs_username_broker"
  ON "UserRiskConfigs" ("Username", "BrokerType");

-- Auto-shift columns (if upgrading from schema before auto-shift feature)
ALTER TABLE "UserRiskConfigs"
  ADD COLUMN IF NOT EXISTS "AutoShiftEnabled"      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "AutoShiftThresholdPct" numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "AutoShiftMaxCount"     integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "AutoShiftStrikeGap"    integer NOT NULL DEFAULT 1;
```

> [!NOTE]
> Fresh databases created by `EnsureCreatedAsync` get all tables automatically — skip this section.

---

## Running Locally

Open three terminal tabs. Start Seq first if you want structured log search:

```bash
docker start seq   # http://localhost:8080
```

### Tab 1 — API

```bash
cd backend
dotnet run --project KAITerminal.Api
```

API available at: `https://localhost:5001`
Scalar docs at: `https://localhost:5001/scalar/v1`

> [!TIP] First Run — Trust Dev Certificate
> On first run, accept the dev HTTPS certificate:
> ```bash
> dotnet dev-certs https --trust
> ```

### Tab 2 — Worker (Risk Engine + Market Data)

```bash
cd backend
dotnet run --project KAITerminal.Worker
```

The Worker connects to the Upstox WebSocket using the analytics token configured in the Admin page. It will log a warning and remain idle until the token is set.

### Tab 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: `http://localhost:3000`

---

## First-Time Setup

1. **Open** `http://localhost:3000` → you'll be redirected to Google login
2. **Log in** with `suvrajit.ray@gmail.com` — this account is auto-activated as admin
3. **Connect a broker** — Settings → Connect Brokers → enter Upstox API key + secret → Authenticate
4. **Set the analytics token** — User menu → Admin → paste the Upstox Analytics Token → Save
   - Obtain from [Upstox Developer Portal](https://upstox.com/developer/api-documentation/analytics-token)
   - This token is valid for 1 year and is used for market data WebSocket and option contract fetching
5. **Restart the Worker** — it reads the analytics token on startup. After saving the token, restart the Worker process to connect the market data feed.

---

## Useful Commands

```bash
# Check Redis keys
redis-cli keys "appsetting:*"
redis-cli get "appsetting:upstox_analytics_token"

# Watch live LTP ticks (published by Worker → MarketDataService)
redis-cli subscribe ltp:feed

# Watch instrument subscription requests (published by API → RedisLtpRelay)
redis-cli subscribe ltp:sub-req

# Clear all Redis data (dev reset)
redis-cli flushall

# Check which services are running
brew services list

# Hot-reload API (auto-restarts on file save)
cd backend && dotnet watch --project KAITerminal.Api

# TypeScript check
cd frontend && npm run build

# Lint
cd frontend && npm run lint
```

---

## Architecture Quick Reference

| Process | Port | Role |
|---------|------|------|
| KAITerminal.Api | 5001 (HTTPS) | REST API + SignalR hubs |
| KAITerminal.Worker | — | Risk engine + market data WebSocket |
| Frontend (Vite) | 3000 (HTTP) | React UI |
| Redis | 6379 | LTP pub/sub (`ltp:feed`, `ltp:sub-req`) + app settings cache + SignalR backplane |
| PostgreSQL 18 | 5432 | Persistent storage |
| Seq (Docker) | 5341 (ingest) / 8080 (UI) | Structured log viewer — `http://localhost:8080` |
