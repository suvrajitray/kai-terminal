# Production Deployment Guide — Azure VM

This guide deploys KAI Terminal on a single Azure VM running Ubuntu 24.04 LTS.
Follow the steps **in order** — the sequence matters (NSG before Certbot, DNS before Certbot, temp Nginx before Certbot).

---

## VM — D2as_v5

| Spec | Value |
|------|-------|
| vCPUs | 2 (AMD EPYC) |
| RAM | 8 GB |
| Storage | Standard SSD |
| Series | Dasv5 (general purpose, non-burstable) |

**Verdict: Solid choice for personal/small-team use.** The app runs 5 processes (API + Worker + Redis + PostgreSQL + Nginx) which comfortably fit in 8 GB. Unlike the B-series, the D2as_v5 delivers full 2 vCPU performance at all times — no CPU credit throttling during sustained market-hours load.

> **Note:** D2as_v5 may have limited availability in Indian regions. Try **Central India** first. If unavailable, try `D2as_v4`, `D2s_v3`, or fall back to **UAE North** with D2as_v5.

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

## Step 1 — Create VM in Azure and Connect from Mac

### Create the VM

1. Go to **Azure Portal → Virtual Machines → Create**
2. Choose:
   - **Image**: Ubuntu Server 24.04 LTS
   - **Size**: D2as_v5
   - **Authentication**: SSH public key
   - **Username**: `azureuser`
   - **SSH public key source**: Generate new key pair — download the `.pem` file when prompted
   - **Inbound ports**: Allow SSH (22) for now
3. **Disks**: Standard SSD, 30 GB
4. Click **Review + Create → Create**
5. Note the **Public IP address** from the VM overview page

### Set up SSH on your Mac

```bash
# Move the downloaded key and lock down permissions (SSH refuses keys readable by others)
mv ~/Downloads/kaiterminal_key.pem ~/.ssh/kaiterminal.pem
chmod 600 ~/.ssh/kaiterminal.pem
```

Add a host alias to `~/.ssh/config` so `ssh kaiterminal` just works:

```
Host kaiterminal
    HostName <YOUR-VM-PUBLIC-IP>
    User azureuser
    IdentityFile ~/.ssh/kaiterminal.pem
```

Connect:

```bash
ssh kaiterminal
# Type "yes" to confirm the host fingerprint
# You should land at: azureuser@kaiterminal-vm:~$
```

All remaining commands are run **inside this SSH session** unless stated otherwise.

---

## Step 2 — Open Azure NSG Firewall Ports

Do this **now** — Certbot needs port 80 reachable from the internet or it will fail.

In **Azure Portal → VM → Networking → Inbound port rules**, add:

| Priority | Name | Service | Source | Action |
|----------|------|---------|--------|--------|
| 100 | SSH | SSH (22) | **Your IP only** | Allow |
| 110 | HTTP | HTTP (80) | Any | Allow |
| 120 | HTTPS | HTTPS (443) | Any | Allow |
| 1000 | DenyAll | Any (*) | Any | Deny |

Use the **Service** dropdown (HTTP / HTTPS) — it auto-fills the port and protocol.

**Critical:** Never expose ports 5001, 6379, 5341, or 8080 to the internet.

---

## Step 3 — Configure DNS in Hostinger

Do this **before** running Certbot — certificates fail if DNS isn't pointing at your VM.

1. Log in to Hostinger → **Domains → your domain → DNS / Zone Editor**
2. Delete any existing A records and CNAME records for `@` and `www`
3. Add these records for **each domain** (`.com` and `.in`):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<your VM public IP>` | 300 |
| A | `www` | `<your VM public IP>` | 300 |

4. Wait 5–15 minutes, then verify from your Mac:

```bash
dig kaiterminal.com +short        # must return your VM IP
dig www.kaiterminal.com +short
dig kaiterminal.in +short
dig www.kaiterminal.in +short
```

> Do not proceed to Certbot until all four return the correct IP.

---

## Step 4 — Install Dependencies

Paste this entire block into your SSH session. Takes about 5–10 minutes:

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
```

Verify Redis is bound to localhost only:
```bash
sudo grep "^bind" /etc/redis/redis.conf
# should show: bind 127.0.0.1 -::1
```

---

## Step 5 — Create PostgreSQL Database

```bash
sudo -u postgres psql
```

```sql
CREATE USER kaiuser WITH PASSWORD 'your-strong-password';
CREATE DATABASE kaiterminal OWNER kaiuser;
GRANT ALL PRIVILEGES ON DATABASE kaiterminal TO kaiuser;
\q
```

Verify:
```bash
psql -U kaiuser -d kaiterminal -h localhost -c "SELECT version();"
```

> The app uses `EnsureCreatedAsync` on startup — tables are created automatically on first run.

---

## Step 6 — Set Up GitHub SSH Key on VM

Your Mac's SSH key doesn't transfer to the VM. Generate a new one:

```bash
ssh-keygen -t ed25519 -C "kaiterminal-vm"
# Press Enter 3 times (accept defaults, no passphrase)

cat ~/.ssh/id_ed25519.pub
```

Copy the output. Go to **GitHub → Settings → SSH and GPG keys → New SSH key**, paste and save.

Test:
```bash
ssh -T git@github.com
# Hi <username>! You've successfully authenticated...
```

---

## Step 7 — Create App User and Clone Repo

```bash
# Create app user (runs services, no login shell)
sudo useradd -r -s /bin/false -d /opt/kaiterminal kaiterm

# Create directories
sudo mkdir -p /opt/kaiterminal/{api,worker}
sudo mkdir -p /var/www/kaiterminal
sudo chown $USER:$USER /opt/kaiterminal

# Clone the repo
git clone git@github.com:your-username/kaiterminal.git /opt/kaiterminal/repo
```

---

## Step 8 — SSL Certificates (Certbot)

First, deploy a temporary minimal Nginx config so Certbot can verify domain ownership over port 80:

```bash
sudo rm -f /etc/nginx/sites-enabled/default

sudo bash -c 'cat > /etc/nginx/sites-enabled/kaiterminal' << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name kaiterminal.com www.kaiterminal.com kaiterminal.in www.kaiterminal.in;
    root /var/www/kaiterminal;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
EOF

sudo nginx -t
sudo systemctl restart nginx
```

Now run Certbot for both domains:

```bash
sudo certbot --nginx -d kaiterminal.com -d www.kaiterminal.com
sudo certbot --nginx -d kaiterminal.in -d www.kaiterminal.in
```

Certbot auto-renews certificates every 90 days via a systemd timer.

Now replace the temp config with the real one from the repo:

```bash
sudo cp /opt/kaiterminal/repo/deploy/nginx.conf /etc/nginx/sites-enabled/kaiterminal
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 9 — Secrets Configuration

Secrets are passed as environment variables via files that are **never committed to the repo**.

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

## Step 10 — Build and Deploy

### Build the frontend

```bash
cd /opt/kaiterminal/repo/frontend
npm ci
npm run build   # outputs to frontend/dist/

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

## Step 11 — Systemd Services

```bash
sudo cp /opt/kaiterminal/repo/deploy/kaiterminal-api.service    /etc/systemd/system/
sudo cp /opt/kaiterminal/repo/deploy/kaiterminal-worker.service /etc/systemd/system/
sudo systemctl daemon-reload

sudo systemctl enable kaiterminal-api kaiterminal-worker
sudo systemctl start kaiterminal-api
sleep 5   # give API a moment before Worker connects
sudo systemctl start kaiterminal-worker
```

Verify:
```bash
sudo systemctl status kaiterminal-api
sudo systemctl status kaiterminal-worker
journalctl -u kaiterminal-api -f
journalctl -u kaiterminal-worker -f
```

---

## Step 12 — UFW (VM-level Firewall)

Second layer of protection on top of Azure NSG:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Step 13 — Google OAuth Redirect URIs

In **Google Cloud Console → OAuth 2.0 credentials**, add to **Authorized redirect URIs**:

```
https://kaiterminal.com/auth/callback
https://kaiterminal.in/auth/callback
```

The `Frontend__Url` in `api.env` must be `https://kaiterminal.com`.

---

## Step 14 — Seq (Optional — Structured Log Viewer)

```bash
docker run -d --name seq --restart unless-stopped \
  -p 127.0.0.1:5341:5341 \
  -p 127.0.0.1:8080:80 \
  -e ACCEPT_EULA=Y \
  -e SEQ_FIRSTRUN_ADMINPASSWORD=<choose-a-password> \
  -v /opt/seq-data:/data \
  datalust/seq:latest
```

Access via SSH tunnel from your Mac:
```bash
ssh -L 9080:localhost:8080 kaiterminal
# then open http://localhost:9080
```

> Port 9080 is used on the Mac side to avoid conflicting with a local Seq instance running on 8080.

**Set up log retention after first login** — otherwise logs will grow and fill the disk:

Seq UI → **Settings → Retention → Add policy** → delete events older than **7 days**.

Monitor disk usage occasionally:
```bash
du -sh /opt/seq-data
```

---

## First-Time Setup Checklist

- [ ] VM created (D2as_v5, Ubuntu 24.04 LTS)
- [ ] SSH key moved to `~/.ssh/kaiterminal.pem`, `chmod 600`, `~/.ssh/config` alias set
- [ ] Azure NSG — SSH (your IP only), HTTP (any), HTTPS (any), DenyAll configured
- [ ] Hostinger DNS — A records for `@` and `www` pointing to VM IP (both .com and .in)
- [ ] DNS propagation verified — all four `dig` commands return VM IP
- [ ] All dependencies installed (.NET 10, Node 20, Redis, PostgreSQL, Nginx, Certbot)
- [ ] PostgreSQL `kaiuser` + `kaiterminal` database created
- [ ] GitHub SSH key generated on VM and added to GitHub
- [ ] Repo cloned to `/opt/kaiterminal/repo`
- [ ] App user `kaiterm` created
- [ ] Temp Nginx config deployed → Certbot run for both domains → real nginx.conf deployed
- [ ] `/etc/kaiterminal/api.env` created with all secrets
- [ ] `/etc/kaiterminal/worker.env` created with all secrets
- [ ] `Api__InternalKey` identical in both env files
- [ ] Frontend + API + Worker built and deployed
- [ ] Systemd services enabled and started
- [ ] UFW enabled
- [ ] Google OAuth redirect URI updated in Cloud Console
- [ ] Log in with `suvrajit.ray@gmail.com` (auto-activated as admin)
- [ ] Set Upstox analytics token via Admin page → restart Worker

---

## Deploying Updates from Your Mac

After the one-time server setup, every update is deployed from your Mac.

### One-time Mac setup

```bash
# Set up passwordless sudo on the server for service restarts
ssh kaiterminal

sudo tee /etc/sudoers.d/kaiterminal-deploy << 'EOF'
azureuser ALL=(ALL) NOPASSWD: /bin/systemctl restart kaiterminal-api, \
                               /bin/systemctl restart kaiterminal-worker, \
                               /bin/chown -R kaiterm\:kaiterm /opt/kaiterminal/api, \
                               /bin/chown -R kaiterm\:kaiterm /opt/kaiterminal/worker
EOF
sudo chmod 440 /etc/sudoers.d/kaiterminal-deploy
exit
```

Edit `deploy/deploy.sh` on your Mac — set the server IP:
```bash
SERVER="azureuser@20.193.130.6"
```

### Running a deploy

```bash
./deploy/deploy.sh             # full deploy (frontend + API + Worker)
./deploy/deploy.sh --frontend  # frontend only
./deploy/deploy.sh --backend   # API + Worker only
```

> Restart the Worker **outside market hours** (before 9:00 AM or after 3:35 PM IST).

---

## Monitoring

```bash
# Service status
sudo systemctl status kaiterminal-api kaiterminal-worker redis postgresql nginx

# Live logs
journalctl -u kaiterminal-api -f
journalctl -u kaiterminal-worker -f

# Redis memory
redis-cli info memory | grep used_memory_human

# PostgreSQL DB size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('kaiterminal'));"

# Disk space
df -h /
```

---

## Architecture Quick Reference

| Process | Port | Accessible From |
|---------|------|-----------------|
| Nginx | 80, 443 | Internet (via NSG) |
| KAITerminal.Api | 5001 | localhost only |
| KAITerminal.Worker | — | localhost only |
| Redis | 6379 | localhost only |
| PostgreSQL | 5432 | localhost only |
| Seq | 5341 (ingest), 8080 (UI) | localhost only — SSH tunnel to access |
