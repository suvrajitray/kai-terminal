# tmux Cheatsheet

All shortcuts use the prefix `Ctrl+B` followed by the key.

## Sessions

```bash
tmux                        # start new session
tmux new -s name            # start named session
tmux attach -t name         # attach to session
tmux attach                 # attach to last session
tmux ls                     # list sessions
tmux kill-session -t name   # kill a session
```

| Shortcut | Action |
|----------|--------|
| `Ctrl+B d` | Detach from session (leaves it running) |
| `Ctrl+B $` | Rename current session |
| `Ctrl+B s` | Switch between sessions |

## Windows (tabs)

| Shortcut | Action |
|----------|--------|
| `Ctrl+B c` | Create new window |
| `Ctrl+B ,` | Rename current window |
| `Ctrl+B w` | List and switch windows |
| `Ctrl+B n` | Next window |
| `Ctrl+B p` | Previous window |
| `Ctrl+B 0-9` | Switch to window by number |
| `Ctrl+B &` | Kill current window |

## Panes (splits)

| Shortcut | Action |
|----------|--------|
| `Ctrl+B %` | Split vertically (side by side) |
| `Ctrl+B "` | Split horizontally (top/bottom) |
| `Ctrl+B arrow` | Move between panes |
| `Ctrl+B q` | Flash pane numbers on screen |
| `Ctrl+B q 0-9` | Jump to pane by number |
| `Ctrl+B z` | Zoom pane (toggle fullscreen) |
| `Ctrl+B x` | Kill current pane |
| `Ctrl+B {` | Move pane left |
| `Ctrl+B }` | Move pane right |
| `Ctrl+B space` | Cycle through layouts |

## Layouts

| Shortcut | Layout |
|----------|--------|
| `Ctrl+B Alt+1` | Even horizontal |
| `Ctrl+B Alt+2` | Even vertical |
| `Ctrl+B Alt+5` | Tiled (2x2 grid) |

## Resize Panes

| Shortcut | Action |
|----------|--------|
| `Ctrl+B Ctrl+arrow` | Resize pane by 1 |
| `Ctrl+B Alt+arrow` | Resize pane by 5 |

## Copy Mode (scroll up)

| Shortcut | Action |
|----------|--------|
| `Ctrl+B [` | Enter copy/scroll mode |
| `q` | Exit copy mode |
| `arrow keys` | Scroll |
| `Ctrl+U` | Scroll up half page |
| `Ctrl+D` | Scroll down half page |
| `g` | Go to top |
| `G` | Go to bottom |

## Misc

| Shortcut | Action |
|----------|--------|
| `Ctrl+B t` | Show clock |
| `Ctrl+B ?` | List all shortcuts |
| `Ctrl+B :` | Open command prompt |

## Nested tmux (local + remote)

When SSHed into a server that also runs tmux, press the prefix **twice** to send it to the inner session:

```
Ctrl+B Ctrl+B d   # detach from remote tmux (not local)
```
