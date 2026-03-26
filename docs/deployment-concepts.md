# Deployment Concepts — Plain English Reference

This document explains what each deployment file does and why, written for someone new to Linux and Nginx.

---

## The Big Picture

On your laptop you run everything manually in three terminal tabs:

```
Tab 1: dotnet run --project KAITerminal.Api
Tab 2: dotnet run --project KAITerminal.Worker
Tab 3: npm run dev
```

On a production server **nobody is sitting there running commands**. The server must:

- Start everything automatically when it boots
- Keep everything running 24/7
- Restart automatically if something crashes
- Serve your app securely over HTTPS

Three tools handle this:

| Tool | Job |
|------|-----|
| **Nginx** | Traffic cop — routes requests to the right place, handles SSL |
| **Systemd** | Process manager — keeps your apps alive forever |
| **EnvironmentFile** | Secrets store — keeps passwords off the repo |

---

## What is Nginx?

Nginx is a **reverse proxy and web server** that sits at the front door of your server.

Your server has one public IP. When someone visits `https://kai.yourdomain.com`, the request arrives at port 443. Nginx looks at the URL and decides where to send it:

```
Request URL                              Nginx sends it to...
───────────────────────────────────────────────────────────────
https://kai.yourdomain.com/              Serve React files from /var/www/kaiterminal
https://kai.yourdomain.com/api/...       Forward to .NET API on localhost:5001
https://kai.yourdomain.com/auth/...      Forward to .NET API on localhost:5001
https://kai.yourdomain.com/hubs/...      Forward to .NET API (WebSocket mode)
```

### SSL Termination

Nginx also handles the **padlock / HTTPS**. Your .NET API runs on plain HTTP internally. Nginx decrypts the incoming HTTPS traffic and passes it to your API as HTTP. This is called *SSL termination*.

```
Browser ──HTTPS──► Nginx ──HTTP──► .NET API on localhost:5001
                    ↑
            Holds the SSL certificate
            Your app code never touches it
```

---

## Reading `deploy/nginx.conf`

```nginx
# Block 1 — redirect all HTTP to HTTPS
server {
    listen 80;
    server_name YOURDOMAIN;
    return 301 https://$host$request_uri;   # 301 = permanent redirect
}

# Block 2 — the main HTTPS server
server {
    listen 443 ssl;
    server_name YOURDOMAIN;

    # SSL certificate files (filled in by Certbot/Let's Encrypt)
    ssl_certificate     /etc/letsencrypt/live/YOURDOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOURDOMAIN/privkey.pem;

    # Serve React app files from this folder
    root /var/www/kaiterminal;

    # SPA fallback — explained below
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Forward API and auth requests to .NET
    location ~ ^/(api|auth)/ {
        proxy_pass http://localhost:5001;
        proxy_set_header X-Forwarded-Proto $scheme;  # tell .NET it came via HTTPS
    }

    # Forward SignalR WebSocket connections
    location /hubs/ {
        proxy_pass http://localhost:5001;
        proxy_set_header Upgrade $http_upgrade;   # ← these two lines enable
        proxy_set_header Connection "upgrade";    #   WebSocket connections
        proxy_read_timeout 86400s;  # keep open for 24h (SignalR needs persistent connection)
    }
}
```

### The SPA Fallback Trick

When someone visits `https://kai.yourdomain.com/dashboard`, Nginx looks for a file called `dashboard` in `/var/www/kaiterminal/` — it doesn't exist. Without `try_files`, Nginx returns 404.

With `try_files $uri $uri/ /index.html`, Nginx falls back to serving `index.html`, and React Router takes over and shows the dashboard. **This is required for every React / Vue / Angular app.**

---

## What is Systemd?

Systemd is Linux's **process manager** — it starts, stops, and monitors programs. Redis, Nginx, and PostgreSQL are all managed by systemd. You're adding your API and Worker to that same system.

A `.service` file is a config file telling systemd: *"here is a program I want you to manage forever."*

---

## Reading `deploy/kaiterminal-api.service`

```ini
[Unit]
Description=KAI Terminal API
After=network.target redis.service postgresql.service
# ↑ Don't start until network, Redis, and PostgreSQL are ready.
#   Your API connects to both on startup — if they're not up yet, it crashes.

[Service]
User=kaiterm
# ↑ Run as this non-root user (security best practice).
#   If your app gets hacked, the attacker only has kaiterm's limited permissions.

WorkingDirectory=/opt/kaiterminal/api

ExecStart=/usr/bin/dotnet /opt/kaiterminal/api/KAITerminal.Api.dll
# ↑ The actual command to run. This is the compiled output of "dotnet publish".
#   Same as running "dotnet run" but much faster — no build step.

Restart=always      # If it crashes, restart it.
RestartSec=5        # Wait 5 seconds first (avoid restart loops).

# Tell ASP.NET Core it's running in production
Environment=ASPNETCORE_ENVIRONMENT=Production

# Listen on HTTP internally — Nginx handles HTTPS
Environment=ASPNETCORE_URLS=http://localhost:5001

# Trust the X-Forwarded-Proto header Nginx sends.
# Without this, .NET thinks requests are HTTP even though Nginx received HTTPS.
# Google OAuth would break — the redirect URL would say http:// instead of https://.
Environment=ASPNETCORE_FORWARDEDHEADERS_ENABLED=true

# Load secrets from this file (see Secrets section below)
EnvironmentFile=/etc/kaiterminal/api.env

[Install]
WantedBy=multi-user.target
# ↑ Start this service when the server boots normally.
```

The Worker service is identical in structure — just points to the Worker `.dll` and depends on the API service too.

---

## Secrets Management — Why Not `appsettings.json`?

`appsettings.json` is committed to your git repo. Anyone who can see the repo can see database passwords, JWT signing keys, and Google OAuth secrets. That's bad.

Instead, on the server you create `/etc/kaiterminal/api.env`:

```env
ConnectionStrings__DefaultConnection=Host=localhost;Database=kaiterminal;Username=kaiuser;Password=SuperSecretPassword
Jwt__Key=some-long-random-string-nobody-can-guess
GoogleAuth__ClientId=123456-abc.apps.googleusercontent.com
GoogleAuth__ClientSecret=GOCSPX-...
Frontend__Url=https://kai.yourdomain.com
Api__InternalKey=550e8400-e29b-41d4-a716-446655440000
```

**The `__` (double underscore)** is ASP.NET Core's separator for nested config keys. `Jwt__Key` maps to `appsettings.json`'s `"Jwt": { "Key": "..." }`. So environment variables override whatever is in appsettings.json.

This file gets locked down on the server so only the app can read it:
```bash
sudo chmod 600 /etc/kaiterminal/api.env   # only owner can read/write
sudo chown root:kaiterm /etc/kaiterminal/api.env
```

The file never gets committed to git. It only exists on the production server.

---

## What is `frontend/.env.production`?

When you run `npm run build`, Vite **bakes environment variables into the JavaScript bundle at build time**. The compiled JS files contain your API URL hardcoded inside them.

- `.env` — used during `npm run dev` → API URL is `https://localhost:5001`
- `.env.production` — used during `npm run build` → API URL is `https://kai.yourdomain.com`

Vite automatically picks up `.env.production` when building. You never need to switch manually.

```bash
npm run build   # Vite reads .env.production automatically
                # Output in dist/ has your real domain baked in
```

Before building for production, replace `YOURDOMAIN` in the file:
```bash
sed -i 's/YOURDOMAIN/kai.yourdomain.com/g' frontend/.env.production
```

---

## Full Deployment Flow — Step by Step

```
1. Create Azure VM (Ubuntu 24.04 LTS)
   └── Note the public IP, e.g. 20.10.50.100

2. Point your domain to the VM
   └── DNS A record: kai.yourdomain.com → 20.10.50.100
   └── Wait 5–15 minutes for DNS to propagate worldwide

3. SSH into the server
   └── ssh azureuser@20.10.50.100

4. Install software (one-time)
   └── .NET 10, Node.js 20, Redis, PostgreSQL, Nginx, Certbot, Docker

5. Create the PostgreSQL database
   └── CREATE USER kaiuser / CREATE DATABASE kaiterminal

6. Clone your repo
   └── git clone <your-repo> /opt/kaiterminal/repo

7. Build the frontend
   └── Edit .env.production — replace YOURDOMAIN with your real domain
   └── npm ci && npm run build → creates dist/ folder
   └── Copy dist/ to /var/www/kaiterminal/ (Nginx serves from here)

8. Build the backend
   └── dotnet publish KAITerminal.Api → /opt/kaiterminal/api/
   └── dotnet publish KAITerminal.Worker → /opt/kaiterminal/worker/

9. Create secrets files on the server
   └── /etc/kaiterminal/api.env — DB password, JWT key, Google OAuth, etc.
   └── /etc/kaiterminal/worker.env — DB password, internal key
   └── chmod 600 both files

10. Configure Nginx
    └── Copy nginx.conf (with your domain) to /etc/nginx/sites-available/
    └── nginx -t (test for typos — always do this before restarting)
    └── systemctl reload nginx

11. Get a free SSL certificate (Let's Encrypt)
    └── certbot --nginx -d kai.yourdomain.com
    └── Certbot edits nginx.conf automatically and adds the cert paths
    └── Auto-renews every 90 days via a systemd timer

12. Install and start systemd services
    └── Copy .service files to /etc/systemd/system/
    └── systemctl daemon-reload
    └── systemctl enable kaiterminal-api kaiterminal-worker
    └── systemctl start kaiterminal-api
    └── (wait 5 seconds)
    └── systemctl start kaiterminal-worker

13. Lock down the Azure firewall (NSG)
    └── Allow port 22 (SSH) — your IP only
    └── Allow port 80 and 443 — everyone
    └── Block everything else (5001, 6379, 5432 must NOT be public)

14. Update Google OAuth
    └── Google Cloud Console → OAuth credentials
    └── Add https://kai.yourdomain.com/auth/callback to Authorized redirect URIs

15. First login
    └── Visit https://kai.yourdomain.com
    └── Sign in with your Google account
    └── Admin page → paste Upstox analytics token
    └── sudo systemctl restart kaiterminal-worker
```

---

## Everyday Operations Cheat Sheet

```bash
# ── Check if services are running ──────────────────────────────
sudo systemctl status kaiterminal-api
sudo systemctl status kaiterminal-worker
sudo systemctl status kaiterminal-api kaiterminal-worker redis postgresql nginx

# ── View live logs (like your terminal output) ─────────────────
journalctl -u kaiterminal-api -f              # follow live
journalctl -u kaiterminal-worker -f           # follow live
journalctl -u kaiterminal-api --since "1h ago"  # last hour only

# ── Restart a service ──────────────────────────────────────────
sudo systemctl restart kaiterminal-api
sudo systemctl restart kaiterminal-worker

# ── Nginx ──────────────────────────────────────────────────────
sudo nginx -t                    # test config for errors (always before reloading)
sudo systemctl reload nginx      # apply config changes without dropping connections
sudo systemctl restart nginx     # full restart (drops all connections briefly)

# ── Deploy an update ───────────────────────────────────────────
cd /opt/kaiterminal/repo && git pull
cd frontend && npm ci && npm run build
sudo cp -r dist/* /var/www/kaiterminal/
cd ../backend
dotnet publish KAITerminal.Api -c Release -o /opt/kaiterminal/api
sudo systemctl restart kaiterminal-api
```

> **Restart the Worker outside market hours** (before 9:00 AM or after 3:35 PM IST). It reconnects the Upstox WebSocket on startup — restarting mid-session drops live data briefly.

---

## Directory Layout on the Server

```
/opt/kaiterminal/
    repo/           ← git clone of your codebase (source)
    api/            ← compiled .NET API  (dotnet publish output)
    worker/         ← compiled .NET Worker (dotnet publish output)

/var/www/kaiterminal/
    index.html      ← React app entry point
    assets/         ← Vite-compiled JS and CSS (hashed filenames)

/etc/kaiterminal/
    api.env         ← API secrets  (chmod 600 — never in git)
    worker.env      ← Worker secrets (chmod 600 — never in git)

/etc/nginx/
    sites-available/kaiterminal   ← your nginx.conf (copied here)
    sites-enabled/kaiterminal     ← symlink to the above (activates it)

/etc/systemd/system/
    kaiterminal-api.service       ← your .service files (copied here)
    kaiterminal-worker.service

/var/lib/postgresql/              ← PostgreSQL data files (managed by postgres)
/var/lib/redis/                   ← Redis data files
```

---

## Quick Analogy Summary

| Component | Real-world analogy |
|-----------|-------------------|
| Nginx | Receptionist at a hotel — routes guests to the right room |
| Systemd service | A job contract — tells Linux "keep this program running, restart if it stops" |
| EnvironmentFile | A safe — holds secrets separately from the code |
| `dotnet publish` | Compiling/packaging your app for shipping — like building an .exe |
| Certbot / Let's Encrypt | Free SSL certificate authority — gives you the HTTPS padlock |
| UFW / NSG | Bouncer at the door — blocks ports you don't want public |
