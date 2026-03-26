# Production Deployment Guide — Azure VM

This guide deploys KAI Terminal on a single Azure VM running Ubuntu 24.04 LTS.

---

## VM Assessment — B2as_v2

| Spec | Value |
|------|-------|
| vCPUs | 2 (AMD EPYC) |
| RAM | 8 GB |
| Storage | Standard SSD |
| Series | Bsas_v2 (burstable) |

**Verdict: Good choice for personal/small-team use.** The app runs 5 processes (API + Worker + Redis + PostgreSQL + Nginx) which comfortably fit in 8 GB.

**One thing to watch:** The B-series VMs in Azure are *burstable* — they accumulate CPU credits during idle periods and spend them during spikes. During market hours (9:15–15:30 IST), the Worker runs continuously. If CPU credits drain, performance throttles to the baseline (20% of 1 vCPU). In practice the app's CPU load is very low, so this should not be an issue. Monitor the **CPU Credits Remaining** metric in Azure Monitor during the first few trading days. If credits regularly hit zero, consider upgrading to **D2as_v5** (non-burstable, similar cost).

---

## Architecture on the VM

```
Internet → Azure NSG → Nginx (443/80)
                         ├── /assets/*         → /var/www/kaiterminal (static files)
                         ├── /                 → /var/www/kaiterminal/index.html (SPA)
                         ├── /api/* /auth/*    → http://localhost:5001 (API)
                         └── /hubs/*           → http://localhost:5001 (SignalR WebSocket)

localhost:5001  KAITerminal.Api    (systemd: kaiterminal-api)
localhost:5341  KAITerminal.Worker (systemd: kaiterminal-worker)
localhost:6379  Redis              (systemd: redis)
localhost:5432  PostgreSQL         (systemd: postgresql)
localhost:8080  Seq                (Docker container, optional)
```

---

## Prerequisites on the VM

### 1. Initial system update

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip
```

### 2. Install .NET 10 SDK

```bash
wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh
chmod +x dotnet-install.sh
sudo ./dotnet-install.sh --channel 10.0 --install-dir /usr/share/dotnet
sudo ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet
dotnet --version   # should be 10.x
```

### 3. Install Node.js 20 (for building the frontend)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # 20+
```

### 4. Install Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping   # PONG
```

Secure Redis — bind to localhost only (default on Ubuntu, verify):
```bash
grep "^bind" /etc/redis/redis.conf   # should show: bind 127.0.0.1 -::1
```

### 5. Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Create the database and user:
```bash
sudo -u postgres psql
```

```sql
CREATE USER kaiuser WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE kaiterminal OWNER kaiuser;
GRANT ALL PRIVILEGES ON DATABASE kaiterminal TO kaiuser;
\q
```

Verify the connection:
```bash
psql -U kaiuser -d kaiterminal -h localhost -c "SELECT version();"
```

PostgreSQL binds to localhost by default on Ubuntu — no extra hardening needed. Verify:
```bash
grep "^listen_addresses" /etc/postgresql/*/main/postgresql.conf
# should show: listen_addresses = 'localhost'
```

> The app uses `EnsureCreatedAsync` on startup — tables are created automatically on first run.

### 6. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 7. Install Certbot (Let's Encrypt SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 8. Install Docker (optional — for Seq log viewer)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # then log out and back in
```

---

## Create App User

Run the app as a non-root user:

```bash
sudo useradd -r -s /bin/false -d /opt/kaiterminal kaiterm
```

---

## Build and Deploy

### Clone the repo

```bash
sudo mkdir -p /opt/kaiterminal
sudo chown $USER:$USER /opt/kaiterminal
git clone <your-repo-url> /opt/kaiterminal/repo
cd /opt/kaiterminal/repo
```

### Build the frontend

Edit `frontend/.env.production` — replace `YOURDOMAIN` with your actual domain:

```bash
sed -i 's/YOURDOMAIN/kai.yourdomain.com/g' frontend/.env.production
```

Build:
```bash
cd frontend
npm ci
npm run build   # outputs to frontend/dist/
```

Deploy to Nginx root:
```bash
sudo mkdir -p /var/www/kaiterminal
sudo cp -r dist/* /var/www/kaiterminal/
sudo chown -R www-data:www-data /var/www/kaiterminal
```

### Build the API

```bash
cd /opt/kaiterminal/repo/backend
dotnet publish KAITerminal.Api -c Release -o /opt/kaiterminal/api
sudo chown -R kaiterm:kaiterm /opt/kaiterminal/api
```

### Build the Worker

```bash
dotnet publish KAITerminal.Worker -c Release -o /opt/kaiterminal/worker
sudo chown -R kaiterm:kaiterm /opt/kaiterminal/worker
```

---

## Secrets Configuration

Secrets are passed via environment files that are **never committed to the repo**. ASP.NET Core reads them as environment variables that override appsettings.json.

### Create the secrets directory

```bash
sudo mkdir -p /etc/kaiterminal
sudo chmod 750 /etc/kaiterminal
```

### API secrets — `/etc/kaiterminal/api.env`

```bash
sudo nano /etc/kaiterminal/api.env
```

```env
ConnectionStrings__DefaultConnection=Host=localhost;Database=kaiterminal;Username=kaiuser;Password=<your-db-password>
ConnectionStrings__Redis=localhost:6379
Jwt__Key=<random-256-bit-secret>
GoogleAuth__ClientId=<google-oauth-client-id>
GoogleAuth__ClientSecret=<google-oauth-client-secret>
Frontend__Url=https://kai.yourdomain.com
Api__InternalKey=<any-uuid>
Serilog__WriteTo__1__Args__serverUrl=http://localhost:5341
```

```bash
sudo chmod 600 /etc/kaiterminal/api.env
sudo chown root:kaiterm /etc/kaiterminal/api.env
```

### Worker secrets — `/etc/kaiterminal/worker.env`

```bash
sudo nano /etc/kaiterminal/worker.env
```

```env
ConnectionStrings__DefaultConnection=Host=localhost;Database=kaiterminal;Username=kaiuser;Password=<your-db-password>
ConnectionStrings__Redis=localhost:6379
Api__InternalKey=<same-uuid-as-api>
Api__BaseUrl=http://localhost:5001
Serilog__WriteTo__1__Args__serverUrl=http://localhost:5341
```

```bash
sudo chmod 600 /etc/kaiterminal/worker.env
sudo chown root:kaiterm /etc/kaiterminal/worker.env
```

> `Api__InternalKey` must be **identical** in both files. `__` (double underscore) is the ASP.NET Core env var separator for nested keys.

---

## Nginx Setup

### Install site config

Edit `deploy/nginx.conf` — replace `YOURDOMAIN`:
```bash
sed -i 's/YOURDOMAIN/kai.yourdomain.com/g' /opt/kaiterminal/repo/deploy/nginx.conf
sudo cp /opt/kaiterminal/repo/deploy/nginx.conf /etc/nginx/sites-available/kaiterminal
sudo ln -s /etc/nginx/sites-available/kaiterminal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # remove default site
sudo nginx -t   # test config
```

### Obtain SSL certificate

Point your DNS A record to the VM's public IP **before** running Certbot:

```bash
sudo certbot --nginx -d kai.yourdomain.com
```

Certbot automatically edits the Nginx config to add SSL paths and schedules auto-renewal via a systemd timer.

### Start Nginx

```bash
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Systemd Services

### Install service files

```bash
sudo cp /opt/kaiterminal/repo/deploy/kaiterminal-api.service    /etc/systemd/system/
sudo cp /opt/kaiterminal/repo/deploy/kaiterminal-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### Enable and start

```bash
sudo systemctl enable kaiterminal-api kaiterminal-worker
sudo systemctl start  kaiterminal-api
sleep 5   # give API a moment to start before Worker connects
sudo systemctl start  kaiterminal-worker
```

### Verify they're running

```bash
sudo systemctl status kaiterminal-api
sudo systemctl status kaiterminal-worker
journalctl -u kaiterminal-api -f        # tail live logs
journalctl -u kaiterminal-worker -f
```

---

## Seq (Optional — Structured Log Viewer)

```bash
docker run -d --name seq --restart unless-stopped \
  -p 127.0.0.1:5341:5341 \
  -p 127.0.0.1:8080:80 \
  -e ACCEPT_EULA=Y \
  -e SEQ_FIRSTRUN_ADMINPASSWORD=<choose-a-password> \
  -v /opt/seq-data:/data \
  datalust/seq:latest
```

> Note: `-p 127.0.0.1:5341:5341` binds only to localhost — Seq is **not** accessible from the internet.

Access Seq by SSH tunnel from your laptop:
```bash
ssh -L 8080:localhost:8080 <user>@<vm-ip>
# then open http://localhost:8080 in your browser
```

---

## Azure Network Security Group (Firewall)

In the Azure portal → VM → Networking → Inbound port rules, configure:

| Priority | Name | Port | Source | Action |
|----------|------|------|--------|--------|
| 100 | SSH | 22 | **Your IP only** | Allow |
| 110 | HTTP | 80 | Any | Allow |
| 120 | HTTPS | 443 | Any | Allow |
| 1000 | DenyAll | * | Any | Deny |

**Critical:** Never expose ports 5001, 6379, 5341, or 8080 to the internet.

Also enable UFW on the VM as a second layer:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Google OAuth — Update Redirect URI

In Google Cloud Console → OAuth 2.0 credentials, add:

```
https://kai.yourdomain.com/auth/callback
```

to **Authorized redirect URIs**. Without this, Google login will fail.

---

## First-Time Setup Checklist

- [ ] VM created, SSH key installed
- [ ] DNS A record pointing to VM public IP
- [ ] All dependencies installed (.NET, Node, Redis, PostgreSQL, Nginx, Certbot)
- [ ] PostgreSQL `kaiuser` + `kaiterminal` database created
- [ ] Repo cloned to `/opt/kaiterminal/repo`
- [ ] Frontend built and copied to `/var/www/kaiterminal`
- [ ] API and Worker published to `/opt/kaiterminal/api` and `/opt/kaiterminal/worker`
- [ ] `/etc/kaiterminal/api.env` created with all secrets
- [ ] `/etc/kaiterminal/worker.env` created with all secrets
- [ ] `Api__InternalKey` identical in both env files
- [ ] Nginx config deployed and tested (`nginx -t`)
- [ ] SSL certificate issued via Certbot
- [ ] NSG rules configured (22 restricted, 80+443 open, rest blocked)
- [ ] UFW enabled
- [ ] Systemd services enabled and started
- [ ] Google OAuth redirect URI updated in Cloud Console
- [ ] Log in with `suvrajit.ray@gmail.com` (auto-activated as admin)
- [ ] Set Upstox analytics token via Admin page → restart Worker

---

## Deploying Updates

```bash
cd /opt/kaiterminal/repo
git pull

# Rebuild frontend if changed
cd frontend && npm ci && npm run build
sudo cp -r dist/* /var/www/kaiterminal/

# Rebuild API if changed
cd ../backend
dotnet publish KAITerminal.Api -c Release -o /opt/kaiterminal/api
sudo chown -R kaiterm:kaiterm /opt/kaiterminal/api
sudo systemctl restart kaiterminal-api

# Rebuild Worker if changed
dotnet publish KAITerminal.Worker -c Release -o /opt/kaiterminal/worker
sudo chown -R kaiterm:kaiterm /opt/kaiterminal/worker
sudo systemctl restart kaiterminal-worker
```

> Restart Worker **outside market hours** (before 9:00 AM or after 3:35 PM IST) since it reconnects the Upstox WebSocket on startup.

---

## Monitoring

```bash
# Service status
sudo systemctl status kaiterminal-api kaiterminal-worker redis postgresql nginx

# Live API logs
journalctl -u kaiterminal-api -f --since "1h ago"

# Live Worker logs
journalctl -u kaiterminal-worker -f

# Redis memory usage
redis-cli info memory | grep used_memory_human

# PostgreSQL database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('kaiterminal'));"

# Disk space (PostgreSQL data lives in /var/lib/postgresql)
df -h /

# CPU credit balance (check in Azure Monitor portal)
# Alert: CPU Credits Remaining < 20
```

---

## Architecture Quick Reference

| Process | Port | Accessible From |
|---------|------|-----------------|
| Nginx | 80, 443 | Internet (via NSG) |
| KAITerminal.Api | 5001 (HTTP) | localhost only |
| KAITerminal.Worker | — | localhost only |
| Redis | 6379 | localhost only |
| PostgreSQL | 5432 | localhost only |
| Seq | 5341 (ingest), 8080 (UI) | localhost only — SSH tunnel to access |
