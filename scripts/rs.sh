#!/usr/bin/env bash
# Start (or reattach to) the Rolling Straddle session on the server.
#
# Usage:
#   ./deploy/run-rs.sh
#
# - Creates a tmux session named "rs" if it doesn't exist, attaches if it does.
# - Drops to a shell after the process exits so you can read the last log lines.
# - Press Ctrl+C inside tmux to trigger graceful shutdown (closes open positions).
# - Detach without stopping: Ctrl+B  D

set -euo pipefail

SERVER="kaiterminal"
REMOTE_RS_DIR="/opt/kaiterminal/rs"

read -rp "Username: " USERNAME
SESSION="${USERNAME}-rs"

ssh -t "$SERVER" \
  "tmux new-session -A -s '$SESSION' -c '$REMOTE_RS_DIR' 'set -a && source <(sudo cat /etc/kaiterminal/rs.env) && set +a && dotnet KAITerminal.RollingStraddle.dll; exec bash'"
