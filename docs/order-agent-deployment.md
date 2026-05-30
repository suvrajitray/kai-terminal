# Order Agent Deployment Guide

Each user who needs SEBI-compliant order routing gets a dedicated Docker container (`KAITerminal.OrderAgent`) that binds all outbound broker API calls to a pre-registered static IP. This guide covers the full lifecycle: initial server setup, adding a user, verifying it works, and ongoing maintenance.

---

## Prerequisites

- Azure VM running Ubuntu 22.04 (or similar)
- Docker + Docker Compose installed (`docker compose version` should print v2+)
- Additional static IPs assigned to the VM in Azure Portal (one per user)
- The VM's primary IP is already in use by the API/Worker; each agent user needs a **separate** IP
- Admin access to the KAI Terminal web app (to call `POST /api/admin/order-agents`)

---

## Step 1 — Assign Static IPs Permanently (one-time per IP)

Azure assigns additional IPs via the Portal, but the OS must also recognise them. `ip addr add` is lost on reboot; use netplan instead.

**Check which IPs Azure has assigned:**
```bash
# Azure Portal → VM → Networking → IP configurations
# Note all secondary IPs assigned to the NIC (e.g. 10.0.0.5, 10.0.0.6)
```

**Create or edit the netplan override file:**
```bash
sudo nano /etc/netplan/99-static-ips.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eth0:                          # your NIC name — run `ip link` to confirm
      addresses:
        - 10.0.0.5/24              # alice's IP
        - 10.0.0.6/24              # bob's IP
        # add one line per user
```

```bash
sudo netplan apply
ip addr show eth0   # verify all IPs appear under eth0
```

> **Do this before starting any agent container.** If `BIND_IP` is not present on the NIC, the agent will crash at startup.

---

## Step 2 — Run the Database Migration (one-time)

Connect to the PostgreSQL server and run:

```sql
CREATE TABLE "UserOrderAgents" (
    "Username"  VARCHAR NOT NULL PRIMARY KEY,
    "AgentUrl"  VARCHAR NOT NULL,
    "StaticIp"  VARCHAR NOT NULL,
    "IsEnabled" BOOLEAN NOT NULL DEFAULT true
);
```

This table is read at startup by the API, Worker, and Rolling Straddle to populate the in-memory agent registry.

---

## Step 3 — Build the Docker Image (one-time, re-run after code changes)

Run from the `backend/` directory (the Dockerfile copies the whole `backend/` tree):

```bash
cd /path/to/kaiterminal/backend
docker build -f KAITerminal.OrderAgent/Dockerfile -t kaiterminal/order-agent:latest .
```

The image is ~250 MB (ASP.NET runtime). Build time is ~2 minutes on first run (downloads base images), ~30 seconds after that.

> **After deploying new backend code**, rebuild and restart all agent containers:
> ```bash
> docker build -f KAITerminal.OrderAgent/Dockerfile -t kaiterminal/order-agent:latest .
> docker compose up -d --no-deps order-agent-alice order-agent-bob
> ```

---

## Step 4 — Add a User to docker-compose.yml

Open `backend/docker-compose.yml` and add a new service block. Ports must be unique per user (start from 5101 and increment):

```yaml
services:
  order-agent-alice:
    image: kaiterminal/order-agent:latest
    network_mode: host
    restart: unless-stopped
    environment:
      ASPNETCORE_URLS: http://127.0.0.1:5101
      BIND_IP: 10.0.0.5
      ASPNETCORE_ENVIRONMENT: Production
      Upstox__HftBaseUrl: https://api-hft.upstox.com
      Upstox__ApiBaseUrl: https://api.upstox.com
      Zerodha__ApiBaseUrl: https://api.kite.trade

  order-agent-bob:
    image: kaiterminal/order-agent:latest
    network_mode: host
    restart: unless-stopped
    environment:
      ASPNETCORE_URLS: http://127.0.0.1:5102
      BIND_IP: 10.0.0.6
      ASPNETCORE_ENVIRONMENT: Production
      Upstox__HftBaseUrl: https://api-hft.upstox.com
      Upstox__ApiBaseUrl: https://api.upstox.com
      Zerodha__ApiBaseUrl: https://api.kite.trade
```

**Key points:**
- `network_mode: host` — container shares the host NIC; `BIND_IP` must be assigned to that NIC (Step 1)
- `ASPNETCORE_URLS` — loopback-only listener; the port is what you register in `AgentUrl`
- `restart: unless-stopped` — container restarts automatically after server reboot (Docker daemon auto-starts on boot)
- No secrets needed — tokens are passed per-request in headers by the API/Worker

---

## Step 5 — Start the Containers

```bash
cd /path/to/kaiterminal/backend

# Start all agents
docker compose up -d

# Or start a specific user's agent
docker compose up -d order-agent-alice
```

Confirm they are running:
```bash
docker compose ps
# order-agent-alice   running   (healthy)
# order-agent-bob     running
```

---

## Step 6 — Register the Agent in KAI Terminal

Call the admin API (requires admin JWT):

```bash
curl -X POST https://your-api-host/api/admin/order-agents \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice@gmail.com",
    "agentUrl": "http://127.0.0.1:5101",
    "staticIp": "10.0.0.5"
  }'
```

Or use the admin panel in the web app (if wired up).

The API writes to `UserOrderAgents`, and the in-memory registry is updated immediately — no restart needed.

> `username` must exactly match the user's login email (used as the registry key by the API, Worker, and Rolling Straddle).

---

## Step 7 — Verify the Agent is Working

**Check the agent started and bound to the correct IP:**
```bash
docker compose logs order-agent-alice
# Should show: Now listening on: http://127.0.0.1:5101
# No "BindIp is required" or socket bind errors
```

**Smoke-test the agent endpoint directly:**
```bash
curl -s http://127.0.0.1:5101/health
# 200 OK  (if health endpoint is mapped)

# Or check it responds at all:
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5101/
```

**Verify outbound IP on a live order:**

After alice places an order through the terminal, check the Upstox/Zerodha order history — the API source IP should be `10.0.0.5`, not the VM's primary IP.

To test without placing a real order, check the agent container's outbound routing:
```bash
docker exec -it kaiterminal-backend-order-agent-alice-1 \
  sh -c "apt-get install -y curl -q && curl -s https://api.ipify.org"
# Should print 10.0.0.5 (the static IP)
```

---

## Ongoing Operations

### View logs

```bash
# Follow live logs
docker compose logs -f order-agent-alice

# Last 100 lines
docker compose logs --tail=100 order-agent-alice
```

### Restart a container

```bash
docker compose restart order-agent-alice
```

### Update after code changes

```bash
cd /path/to/kaiterminal/backend
docker build -f KAITerminal.OrderAgent/Dockerfile -t kaiterminal/order-agent:latest .
docker compose up -d --no-deps order-agent-alice   # rolling restart, one at a time
```

### Remove a user

1. Remove the service block from `docker-compose.yml`
2. Stop the container: `docker compose down order-agent-alice`
3. Call the delete endpoint: `DELETE /api/admin/order-agents/{username}`
   - This removes the DB row and removes the entry from the live registry immediately

### Check which agents are registered

```bash
curl https://your-api-host/api/admin/order-agents \
  -H "Authorization: Bearer <admin-jwt>"
```

### Fallback behaviour

If a user has **no agent registered**, orders route directly from the Worker/API host using its primary IP — the same behaviour as before this feature was introduced. Existing users are unaffected until an agent is explicitly registered for them.

---

## IP Allocation Reference

| Port | User | Static IP | Azure NIC Config Name |
|------|------|-----------|----------------------|
| 5101 | alice@gmail.com | 10.0.0.5 | ipconfig-alice |
| 5102 | bob@gmail.com | 10.0.0.6 | ipconfig-bob |
| ...  | ...  | ...       | ... |

Update this table as users are added.

---

## Server Restart Checklist

The server reboots daily before market hours. Everything should recover automatically, but verify:

1. `docker compose ps` — all agent containers show `running`
2. `ip addr show eth0` — all static IPs still present (netplan survives reboots)
3. `GET /api/admin/order-agents` — all expected users listed (registry reloaded from DB on API startup)

If a container is not running: `docker compose up -d` (Docker daemon starts on boot; containers with `restart: unless-stopped` auto-start, but this command is safe to run again).
