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

### 4. Install Redis

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

### 5. Install PostgreSQL

```bash
brew install postgresql@17
```

Start PostgreSQL (and auto-start on login):
```bash
brew services start postgresql@17
```

Add the Postgres binaries to your PATH (add to `~/.zshrc`):
```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
```

Then reload:
```bash
source ~/.zshrc
```

Create the database and user:
```bash
psql postgres
```

```sql
CREATE USER kaiuser WITH PASSWORD 'kaipassword';
CREATE DATABASE kaiterminal OWNER kaiuser;
GRANT ALL PRIVILEGES ON DATABASE kaiterminal TO kaiuser;
\q
```

Verify the connection:
```bash
psql -U kaiuser -d kaiterminal -c "SELECT version();"
```

Local connection string (use this in user-secrets):
```
Host=localhost;Database=kaiterminal;Username=kaiuser;Password=kaipassword
```

> The app uses `EnsureCreatedAsync` on startup — tables are created automatically **except** for new tables added after the initial run. See [Manual DB Steps](#manual-db-steps) below.

---

## Clone & Configure

```bash
git clone <repo-url>
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
dotnet user-secrets set "ConnectionStrings:Redis" "localhost:6379"
dotnet user-secrets set "Api:InternalKey" "<any-uuid>"
```

#### KAITerminal.Worker

```bash
cd backend/KAITerminal.Worker

dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Database=kaiterminal;Username=kaiuser;Password=kaipassword"
dotnet user-secrets set "ConnectionStrings:Redis" "localhost:6379"
dotnet user-secrets set "Api:InternalKey" "<same-uuid-as-api>"
dotnet user-secrets set "Api:BaseUrl" "https://localhost:5001"
```

> `Api:InternalKey` must be **identical** in both Api and Worker — it authenticates the Worker→Api risk event webhook.

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

The app auto-creates tables on first run via `EnsureCreatedAsync`. However, tables added after the initial DB creation must be created manually on Neon.

If this is a fresh Neon database, skip this section — everything is created automatically.

If upgrading an existing database, run these as needed:

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
```

---

## Running Locally

Open three terminal tabs.

### Tab 1 — API

```bash
cd backend
dotnet run --project KAITerminal.Api
```

API available at: `https://localhost:5001`
Scalar docs at: `https://localhost:5001/scalar/v1`

> On first run, accept the dev HTTPS certificate:
> ```bash
> dotnet dev-certs https --trust
> ```

### Tab 2 — Worker (Risk Engine)

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

# Watch Redis pub/sub (LTP ticks)
redis-cli subscribe ltp:feed

# Clear all Redis data (dev reset)
redis-cli flushall

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
| Redis | 6379 | LTP pub/sub + app settings cache + SignalR backplane |
| PostgreSQL | 5432 (local) | Persistent storage |
