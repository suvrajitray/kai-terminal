# KAI Terminal — Server Cheatsheet

## Server Access

```bash
ssh kaiterminal                        # SSH into the server
./scripts/server.sh                    # open 2x2 tmux workspace with all panes
```

`server.sh` pane layout:

| | Left | Right |
|-|------|-------|
| **Top** | API logs | Worker logs |
| **Bottom** | Rolling Straddle | General shell |

Press `Ctrl+B Q` to flash pane numbers.

## Deploy

```bash
./deploy/deploy.sh                     # deploy everything (frontend + backend)
./deploy/deploy.sh --frontend          # frontend only
./deploy/deploy.sh --backend           # API + Worker only
./deploy/deploy.sh --rs                # Rolling Straddle only
./scripts/update-services.sh          # update systemd service files + restart
```

## Rolling Straddle

```bash
./scripts/rs.sh                        # SSH in, start/attach tmux session "rs", run
```

On the server directly:
```bash
cd /opt/kaiterminal/rs
dotnet KAITerminal.RollingStraddle.dll
```

Press `Ctrl+C` to trigger graceful shutdown (closes open positions before exit).

## File Locations on Server

| Path | Contents |
|------|---------|
| `/opt/kaiterminal/api/` | API binaries |
| `/opt/kaiterminal/worker/` | Worker binaries |
| `/opt/kaiterminal/rs/` | Rolling Straddle binaries |
| `/var/log/kaiterminal/api.log` | API logs (live) |
| `/var/log/kaiterminal/worker.log` | Worker logs (live) |
| `/etc/systemd/system/kaiterminal-api.service` | API service unit |
| `/etc/systemd/system/kaiterminal-worker.service` | Worker service unit |
| `/etc/kaiterminal/api.env` | API secrets (never committed) |
| `/etc/kaiterminal/worker.env` | Worker secrets (never committed) |
| `/etc/logrotate.d/kaiterminal` | Log rotation config |

## Service Management

```bash
# Status
sudo systemctl status kaiterminal-api
sudo systemctl status kaiterminal-worker

# Start / Stop / Restart
sudo systemctl restart kaiterminal-api
sudo systemctl restart kaiterminal-worker
sudo systemctl stop kaiterminal-api

# Logs
tail -f /var/log/kaiterminal/api.log
tail -f /var/log/kaiterminal/worker.log

# Search logs
grep "ERROR" /var/log/kaiterminal/worker.log
zcat /var/log/kaiterminal/worker.log.2.gz | grep "EXIT"
```

## Secrets / Env Files

Secrets are stored in `/etc/kaiterminal/*.env` on the server — never committed to git.

```bash
sudo nano /etc/kaiterminal/api.env
sudo nano /etc/kaiterminal/worker.env
sudo chmod 600 /etc/kaiterminal/api.env
sudo chmod 600 /etc/kaiterminal/worker.env
```

After editing secrets, restart the affected service:
```bash
sudo systemctl restart kaiterminal-api
```

## Daily Reset Timer

Worker resets at a scheduled time each day via a systemd timer.

```bash
sudo systemctl list-timers kaiterminal-worker-daily-reset.timer   # check next run
sudo systemctl status kaiterminal-worker-daily-reset.timer
```

## Nginx

```bash
sudo systemctl status nginx
sudo nginx -t                          # test config before applying
sudo systemctl reload nginx            # apply config without downtime
sudo nano /etc/nginx/sites-available/kaiterminal
```

## PostgreSQL

```bash
sudo systemctl status postgresql
sudo -u postgres psql                  # open psql as postgres user
\c kaiterminal                         # connect to kaiterminal database
\dt                                    # list tables
```

## Redis

```bash
sudo systemctl status redis
redis-cli ping                         # should return PONG
redis-cli monitor                      # watch live commands
```

## Quick Health Check

```bash
sudo systemctl is-active kaiterminal-api kaiterminal-worker nginx postgresql redis
```
