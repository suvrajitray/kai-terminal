#!/usr/bin/env bash
# Runs daily at 8:30 AM IST before market open.
# Flushes per-user risk state from Redis so every trading day starts clean,
# then restarts the Worker so in-memory caches (positions, token mappings) are fresh.
#
# Install: see kaiterminal-worker-daily-reset.timer

set -euo pipefail

echo "[worker-daily-reset] Flushing risk-state keys from Redis..."
count=$(redis-cli --scan --pattern "risk-state:*" | wc -l | tr -d ' ')
if [[ "$count" -gt 0 ]]; then
    redis-cli --scan --pattern "risk-state:*" | xargs redis-cli DEL
    echo "[worker-daily-reset] Deleted $count key(s)."
else
    echo "[worker-daily-reset] No risk-state keys found — nothing to flush."
fi

echo "[worker-daily-reset] Restarting kaiterminal-worker..."
systemctl restart kaiterminal-worker
echo "[worker-daily-reset] Done."
