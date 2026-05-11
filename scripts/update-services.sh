#!/usr/bin/env bash
# Copy systemd service files to the server and restart both services.
#
# Usage:
#   ./scripts/update-services.sh

set -euo pipefail

SERVER="kaiterminal"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Copying service files..."
scp "$REPO_ROOT/deploy/kaiterminal-api.service" \
    "$REPO_ROOT/deploy/kaiterminal-worker.service" \
    "$REPO_ROOT/deploy/kaiterminal-logrotate" \
    "$SERVER:/tmp/"

echo "Installing and restarting..."
ssh "$SERVER" "sudo mv /tmp/kaiterminal-api.service /etc/systemd/system/ && \
               sudo mv /tmp/kaiterminal-worker.service /etc/systemd/system/ && \
               sudo mv /tmp/kaiterminal-logrotate /etc/logrotate.d/kaiterminal && \
               sudo systemctl daemon-reload && \
               sudo systemctl restart kaiterminal-api kaiterminal-worker"

echo "Done."
ssh "$SERVER" "sudo systemctl is-active kaiterminal-api kaiterminal-worker"
