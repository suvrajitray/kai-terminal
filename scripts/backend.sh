#!/usr/bin/env bash
# Split the current tmux window into 2 panes (top/bottom) for backend logs.
#
# Pane 0 (top)    : kaiterminal-api log
# Pane 1 (bottom) : kaiterminal-worker log
#
# Usage (from inside tmux):
#   ./scripts/backend.sh

set -euo pipefail

SERVER="kaiterminal"

tmux split-window -v
tmux select-layout even-vertical

# SSH into both panes
for pane in 0 1; do
  tmux send-keys -t "$pane" "ssh $SERVER" Enter
done

# Wait for SSH connections to establish
sleep 2

tmux send-keys -t 0 "tail -f /var/log/kaiterminal/api.log" Enter
tmux send-keys -t 1 "tail -f /var/log/kaiterminal/worker.log" Enter
