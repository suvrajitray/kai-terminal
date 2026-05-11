#!/usr/bin/env bash
# Split the current tmux window into a 2x2 grid and set up server panes.
#
# Pane 0 (top-left)  : kaiterminal-api logs
# Pane 1 (top-right) : kaiterminal-worker logs
# Pane 2 (bot-left)  : Rolling Straddle
# Pane 3 (bot-right) : General shell
#
# Usage (from inside tmux):
#   ./scripts/server.sh

set -euo pipefail

SERVER="kaiterminal"

tmux split-window -v
tmux split-window -h -t 0
tmux split-window -h -t 2
tmux select-layout tiled

# SSH into all panes
for pane in 0 1 2 3; do
  tmux send-keys -t "$pane" "ssh $SERVER" Enter
done

# Wait for SSH connections to establish
sleep 2

tmux send-keys -t 0 "tail -f /var/log/kaiterminal/api.log" Enter
tmux send-keys -t 1 "tail -f /var/log/kaiterminal/worker.log" Enter
tmux send-keys -t 2 "cd /opt/kaiterminal/rs && dotnet KAITerminal.RollingStraddle.dll" Enter
tmux send-keys -t 3 "clear" Enter
