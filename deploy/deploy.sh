#!/usr/bin/env bash
# KAI Terminal — deploy from Mac to Azure VM
#
# Usage:
#   ./deploy/deploy.sh              # deploy everything
#   ./deploy/deploy.sh --frontend   # frontend only
#   ./deploy/deploy.sh --backend    # API + Worker only
#
# Requirements (Mac):
#   - SSH key auth configured (no password prompts)
#   - rsync installed (ships with macOS)
#   - .NET SDK installed
#   - Node.js installed
#
# One-time server setup required before first run:
#   See docs/production-deployment.md

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SERVER="azureuser@20.193.130.6"
REMOTE_APP_DIR="/opt/kaiterminal"
REMOTE_WEB_DIR="/var/www/kaiterminal"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Argument parsing ──────────────────────────────────────────────────────────
DEPLOY_FRONTEND=true
DEPLOY_BACKEND=true

if [[ "${1:-}" == "--frontend" ]]; then
  DEPLOY_BACKEND=false
elif [[ "${1:-}" == "--backend" ]]; then
  DEPLOY_FRONTEND=false
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
  rsync -az --delete --progress \
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
  rsync -az --delete --progress \
    /tmp/kai-api-publish/ \
    "$SERVER:$REMOTE_APP_DIR/api/"
  ssh "$SERVER" "sudo chown -R kaiterm:kaiterm $REMOTE_APP_DIR/api"
  ok "Synced to $REMOTE_APP_DIR/api"

  step "Publishing Worker"
  dotnet publish KAITerminal.Worker -c Release -o /tmp/kai-worker-publish --nologo -v quiet
  ok "Published → /tmp/kai-worker-publish"

  step "Deploying Worker to server"
  rsync -az --delete --progress \
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

echo
echo "  ✓ Deployment complete → https://kaiterminal.com"
echo
