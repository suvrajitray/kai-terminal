# Production Deployment Guide — Azure VM

This guide deploys KAI Terminal on a single Azure VM running Ubuntu 24.04 LTS.

---

## VM — D2as_v5

| Spec | Value |
|------|-------|
| vCPUs | 2 (AMD EPYC) |
| RAM | 8 GB |
| Storage | Standard SSD |
| Series | Dasv5 (general purpose, non-burstable) |

**Verdict: Solid choice for personal/small-team use.** The app runs 5 processes (API + Worker + Redis + PostgreSQL + Nginx) which comfortably fit in 8 GB. Unlike the B-series, the D2as_v5 delivers full 2 vCPU performance at all times — no CPU credit throttling during sustained market-hours load.

---

## Step 0 — Create the VM in Azure and Connect from Your Mac

### 1. Create the VM in Azure Portal

1. Go to **Azure Portal → Virtual Machines → Create**
2. Choose:
   - **Image**: Ubuntu Server 24.04 LTS
   - **Size**: D2as_v5 (search "D2as_v5" in the size picker)
   - **Authentication**: SSH public key
   - **Username**: `azureuser`
   - **SSH public key source**: Generate new key pair (Azure will let you download the `.pem` file) — or use your existing key
   - **Inbound ports**: Allow SSH (22) for now; you'll lock it down after setup
3. Under **Disks**: Standard SSD, 30 GB is enough
4. Click **Review + Create → Create**
5. Note the **Public IP address** from the VM overview page

### 2. Set up your SSH key on Mac

If you generated a new key pair in Azure, move the downloaded `.pem` to your SSH folder and fix permissions:

```bash
# Move the downloaded key (adjust filename to match what Azure gave you)
mv ~/Downloads/kaiterminal_key.pem ~/.ssh/kaiterminal.pem
chmod 600 ~/.ssh/kaiterminal.pem
```

Add a host alias so you never have to type the IP again. Open (or create) `~/.ssh/config` and add:

```
Host kaiterminal
    HostName <YOUR-VM-PUBLIC-IP>
    User azureuser
    IdentityFile ~/.ssh/kaiterminal.pem
```

### 3. First SSH connection

```bash
ssh kaiterminal
# Type "yes" when asked to confirm the host fingerprint
# You should land at: azureuser@<vm-name>:~$
```

From here, all remaining commands in this guide are run **inside this SSH session** unless stated otherwise.

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

> **Tip — run it all at once:** Copy the entire block below and paste it into your SSH session. It runs every step in order and takes about 5–10 minutes. Skip to [Create App User](#create-app-user) when it finishes.

```bash
# ── System update ──────────────────────────────────────────────────────────
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip

# ── .NET 10 SDK ────────────────────────────────────────────────────────────
wget -q https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh
chmod +x dotnet-install.sh
sudo ./dotnet-install.sh --channel 10.0 --install-dir /usr/share/dotnet
sudo ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet

# ── Node.js 20 ─────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# ── Redis ──────────────────────────────────────────────────────────────────
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# ── PostgreSQL ─────────────────────────────────────────────────────────────
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# ── Nginx + Certbot ────────────────────────────────────────────────────────
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx

# ── Docker (for Seq — optional) ────────────────────────────────────────────
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

echo ""
echo "✓ All dependencies installed."
echo "  dotnet: $(dotnet --version)"
echo "  node:   $(node --version)"
echo "  redis:  $(redis-cli ping)"
echo "  psql:   $(psql --version)"
echo ""
echo "Next: create the PostgreSQL database, then continue with 'Create App User'."
```

After the script finishes, create the PostgreSQL database (this needs interactive input):

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

Then skip ahead to [Create App User](#create-app-user).

---

### Step-by-step (if you prefer to run each part separately)

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

Edit `frontend/.env.production` — replace `kaiterminal.com` with your actual domain:

```bash
sed -i 's/kaiterminal.com/kaiterminal.com/g' frontend/.env.production
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
Frontend__Url=https://kaiterminal.com
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

```bash
sudo cp /opt/kaiterminal/repo/deploy/nginx.conf /etc/nginx/sites-available/kaiterminal
sudo ln -s /etc/nginx/sites-available/kaiterminal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # remove default site
sudo nginx -t   # test config — fix any errors before continuing
```

### Obtain SSL certificates

Point **both** DNS A records to the VM's public IP in Hostinger before running Certbot:

```
kaiterminal.com  → A record → <VM public IP>
kaiterminal.in   → A record → <VM public IP>
```

Wait 5–15 minutes for DNS to propagate, then get certificates for each domain:

```bash
# Primary domain
sudo certbot --nginx -d kaiterminal.com

# .in domain (used only for the redirect server block)
sudo certbot --nginx -d kaiterminal.in
```

Certbot fills in the certificate paths in nginx.conf and sets up auto-renewal every 90 days via a systemd timer.

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

In Google Cloud Console → OAuth 2.0 credentials, add **both** to **Authorized redirect URIs**:

```
https://kaiterminal.com/auth/callback
https://kaiterminal.in/auth/callback
```

The `.in` entry isn't strictly necessary (since it redirects to `.com` before auth completes), but adding it prevents any edge-case issues. The `Frontend__Url` in `api.env` must be `https://kaiterminal.com`.

---

## First-Time Setup Checklist

- [ ] VM created, SSH key installed (`ssh-copy-id azureuser@<VM-IP>`)
- [ ] Both DNS A records pointing to VM public IP (kaiterminal.com + kaiterminal.in)
- [ ] All dependencies installed (.NET, Node, Redis, PostgreSQL, Nginx, Certbot)
- [ ] PostgreSQL `kaiuser` + `kaiterminal` database created
- [ ] Repo cloned to `/opt/kaiterminal/repo`
- [ ] First deploy run via `./deploy/deploy.sh` from Mac
- [ ] `/etc/kaiterminal/api.env` created with all secrets
- [ ] `/etc/kaiterminal/worker.env` created with all secrets
- [ ] `Api__InternalKey` identical in both env files
- [ ] Nginx config deployed and tested (`nginx -t`)
- [ ] SSL certificate issued via Certbot
- [ ] NSG rules configured (22 restricted, 80+443 open, rest blocked)
- [ ] UFW enabled
- [ ] Systemd services enabled and started
- [ ] Passwordless sudo rule created (`/etc/sudoers.d/kaiterminal-deploy`)
- [ ] `deploy/deploy.sh` — server IP set, tested with `./deploy/deploy.sh`
- [ ] Google OAuth redirect URI updated in Cloud Console
- [ ] Log in with `suvrajit.ray@gmail.com` (auto-activated as admin)
- [ ] Set Upstox analytics token via Admin page → restart Worker

---

## Deploying from Your Mac

After the one-time server setup, every update can be deployed directly from your Mac — no need to SSH in manually.

### One-time Mac setup

#### 1. Set up SSH key authentication

If you haven't already, generate an SSH key and copy it to the server so you never type a password:

```bash
# On your Mac — generate a key (skip if you already have one)
ssh-keygen -t ed25519 -C "kaiterminal-deploy"

# Copy it to the server (you'll type your password once, then never again)
ssh-copy-id azureuser@<YOUR-VM-IP>

# Test it works — should log in with no password prompt
ssh azureuser@<YOUR-VM-IP>
```

#### 2. Allow passwordless sudo for service restarts (on the server)

The deploy script runs `sudo systemctl restart` remotely. Set up a narrow sudoers rule so it works without a password prompt:

```bash
# SSH into the server first
ssh azureuser@<YOUR-VM-IP>

# Create a sudoers rule
sudo tee /etc/sudoers.d/kaiterminal-deploy << 'EOF'
azureuser ALL=(ALL) NOPASSWD: /bin/systemctl restart kaiterminal-api, \
                               /bin/systemctl restart kaiterminal-worker, \
                               /bin/chown -R kaiterm\:kaiterm /opt/kaiterminal/api, \
                               /bin/chown -R kaiterm\:kaiterm /opt/kaiterminal/worker
EOF

sudo chmod 440 /etc/sudoers.d/kaiterminal-deploy

# Log out
exit
```

#### 3. Configure the deploy script

Edit `deploy/deploy.sh` on your Mac — replace the server IP:

```bash
# In deploy/deploy.sh, change this line:
SERVER="azureuser@<YOUR-VM-IP>"
# to e.g.:
SERVER="azureuser@20.10.50.100"
```

### Running a deploy

```bash
# From the repo root on your Mac:

# Deploy everything (frontend + API + Worker)
./deploy/deploy.sh

# Deploy frontend only (CSS/JS change)
./deploy/deploy.sh --frontend

# Deploy backend only (API/Worker code change)
./deploy/deploy.sh --backend
```

The script builds locally on your Mac, transfers the compiled output via `rsync`, then restarts the services over SSH. A full deploy takes about 30–60 seconds.

> Restart the Worker **outside market hours** (before 9:00 AM or after 3:35 PM IST) — it reconnects the Upstox WebSocket on startup.

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
