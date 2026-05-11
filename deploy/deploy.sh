#!/usr/bin/env bash
# KAI Terminal — deploy from Mac to Azure VM
#
# Usage:
#   ./deploy/deploy.sh              # deploy everything
#   ./deploy/deploy.sh --frontend   # frontend only
#   ./deploy/deploy.sh --backend    # API + Worker only
#   ./deploy/deploy.sh --rs         # Rolling Straddle only → /opt/kaiterminal/rs
#
# Requirements (Mac):
#   - SSH key auth configured (no password prompts)
#   - rsync installed (ships with macOS)
#   - .NET SDK installed
#   - Node.js installed
#
# One-time server setup required before first run:
#   See docs/production-deployment.md
#
# One-time daily-reset timer setup (run once on the server):
#   sudo cp deploy/worker-daily-reset.sh /opt/kaiterminal/worker-daily-reset.sh
#   sudo chmod +x /opt/kaiterminal/worker-daily-reset.sh
#   sudo cp deploy/kaiterminal-worker-daily-reset.service /etc/systemd/system/
#   sudo cp deploy/kaiterminal-worker-daily-reset.timer   /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now kaiterminal-worker-daily-reset.timer
#   sudo systemctl list-timers kaiterminal-worker-daily-reset.timer  # verify

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SERVER="kaiterminal"
REMOTE_APP_DIR="/opt/kaiterminal"
REMOTE_WEB_DIR="/var/www/kaiterminal"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Argument parsing ──────────────────────────────────────────────────────────
DEPLOY_FRONTEND=true
DEPLOY_BACKEND=true
DEPLOY_RS=false

if [[ "${1:-}" == "--frontend" ]]; then
  DEPLOY_BACKEND=false
elif [[ "${1:-}" == "--backend" ]]; then
  DEPLOY_FRONTEND=false
elif [[ "${1:-}" == "--rs" ]]; then
  DEPLOY_FRONTEND=false
  DEPLOY_BACKEND=false
  DEPLOY_RS=true
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
step() { echo; echo "──────────────────────────────────────"; echo "  $1"; echo "──────────────────────────────────────"; }
ok()   { echo "  ✓ $1"; }

# ── Frontend ──────────────────────────────────────────────────────────────────
if $DEPLOY_FRONTEND; then
  step "Building frontend"
  cd "$REPO_ROOT/frontend"
  npm ci --silent
  npm run build
  ok "Build complete → frontend/dist/"

  step "Deploying frontend to server"
  rsync -azO --delete --progress \
    "$REPO_ROOT/frontend/dist/" \
    "$SERVER:$REMOTE_WEB_DIR/"
  ok "Synced to $REMOTE_WEB_DIR"
fi

# ── Backend ───────────────────────────────────────────────────────────────────
if $DEPLOY_BACKEND; then
  step "Publishing API"
  cd "$REPO_ROOT/backend"
  dotnet publish KAITerminal.Api -c Release -o /tmp/kai-api-publish --nologo -v quiet
  ok "Published → /tmp/kai-api-publish"

  step "Deploying API to server"
  rsync -azO --delete --progress --rsync-path="sudo rsync" \
    /tmp/kai-api-publish/ \
    "$SERVER:$REMOTE_APP_DIR/api/"
  ssh "$SERVER" "sudo chown -R kaiterm:kaiterm $REMOTE_APP_DIR/api"
  ok "Synced to $REMOTE_APP_DIR/api"

  step "Publishing Worker"
  dotnet publish KAITerminal.Worker -c Release -o /tmp/kai-worker-publish --nologo -v quiet
  ok "Published → /tmp/kai-worker-publish"

  step "Deploying Worker to server"
  rsync -azO --delete --progress --rsync-path="sudo rsync" \
    /tmp/kai-worker-publish/ \
    "$SERVER:$REMOTE_APP_DIR/worker/"
  ssh "$SERVER" "sudo chown -R kaiterm:kaiterm $REMOTE_APP_DIR/worker"
  ok "Synced to $REMOTE_APP_DIR/worker"

  step "Restarting services"
  ssh "$SERVER" "sudo systemctl restart kaiterminal-api"
  ok "kaiterminal-api restarted"
  sleep 4
  ssh "$SERVER" "sudo systemctl restart kaiterminal-worker"
  ok "kaiterminal-worker restarted"

  step "Checking service health"
  ssh "$SERVER" "sudo systemctl is-active kaiterminal-api kaiterminal-worker"
fi

# ── Rolling Straddle ──────────────────────────────────────────────────────────
if $DEPLOY_RS; then
  step "Publishing Rolling Straddle"
  cd "$REPO_ROOT/backend"
  dotnet publish KAITerminal.RollingStraddle -c Release -o /tmp/kai-rs-publish --nologo -v quiet
  ok "Published → /tmp/kai-rs-publish"

  step "Deploying Rolling Straddle to server"
  rsync -azO --delete --progress --rsync-path="sudo rsync" \
    /tmp/kai-rs-publish/ \
    "$SERVER:$REMOTE_APP_DIR/rs/"
  ssh "$SERVER" "sudo chown -R kaiterm:kaiterm $REMOTE_APP_DIR/rs"
  ok "Synced to $REMOTE_APP_DIR/rs"
fi

echo
echo "  ✓ Deployment complete → https://kaiterminal.com"
echo
