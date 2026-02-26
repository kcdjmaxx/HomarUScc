# Telegram Slash Commands & Crash Recovery

**Language:** TypeScript + Bash
**Environment:** Node.js >= 22

## Problem

When Claude Code crashes or fills its context window, the event loop dies. The backend (MCP proxy + backend.ts) keeps running and receiving Telegram messages, but nobody processes them. Max has no way to recover except manually restarting Claude Code from the terminal.

## Solution

Two layers:

### 1. Backend-Intercepted Slash Commands

The Telegram adapter intercepts messages starting with `/` before they reach the event queue. These are handled directly by the backend — no Claude needed.

**Commands:**

| Command | Action |
|---------|--------|
| `/status` | Reply with system health: channels, timers, memory stats, whether Claude is connected (event loop active) |
| `/restart` | Kill current Claude Code process and start a new session with `/homaruscc` |
| `/ping` | Reply "pong" — minimal liveness check |

Unknown `/` commands pass through to Claude as normal messages (so Claude can still see user intent like "/remind me..." which aren't real commands).

### 2. Crash Recovery Script

A shell script (`bin/restart-claude`) that:
1. Finds and kills any running `claude` process in the homaruscc project directory
2. Starts a new `claude` session with the `/homaruscc` skill invocation
3. Reports success/failure back via the backend's Telegram send

The `/restart` command calls this script. It can also be run manually from a terminal.

## Slash Command Handling Flow

1. Telegram adapter receives message with text starting with `/`
2. Adapter checks a command registry (map of command name → handler)
3. If command is registered: execute handler, suppress event delivery to queue
4. If command is not registered: deliver as normal message event

## Command Registry

The backend registers commands during startup. Each command is a function `(chatId: string, args: string) => Promise<string>` that returns a reply message.

Commands are registered on the TelegramChannelAdapter (or a new CommandHandler class if cleaner) — they need access to the backend's subsystems (status, process management).

## `/status` Response Format

```
🟢 Backend: running
🔴 Claude: disconnected (last event loop: 12m ago)
🟢 Telegram: polling
🟢 Dashboard: connected
⏱ Timers: 10 active
🧠 Memory: 132 files, 394 chunks
```

The "Claude connected" check uses the last `/api/wait` call timestamp — if no poll in >2 minutes, Claude is likely dead.

## `/restart` Flow

1. Send "Restarting Claude Code..." acknowledgment via Telegram
2. Execute `bin/restart-claude` as a child process
3. Script kills existing claude process (if any)
4. Script starts new claude session in background
5. Script waits for event loop to become active (polls `/api/wait` activity)
6. Report result via Telegram: "Claude Code restarted" or "Restart failed: <reason>"

## `bin/restart-claude` Script

```bash
#!/bin/bash
# Restart Claude Code with homaruscc session
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Kill existing claude processes for this project
pkill -f "claude.*homaruscc" 2>/dev/null || true
sleep 1

# Start new session
# Uses `claude -p` (print mode) with the /homaruscc command
# Runs in background, detached from terminal
nohup claude --dangerously-skip-permissions -p "/homaruscc" \
  --cwd "$PROJECT_DIR" \
  > /tmp/homaruscc-claude.log 2>&1 &

echo "Claude PID: $!"
```

Note: The exact claude CLI invocation needs validation. The `--dangerously-skip-permissions` flag avoids interactive permission prompts. The `-p` flag runs a prompt non-interactively. We may need `--continue` or a different approach depending on how CC handles session startup.

## Security

- Only messages from allowed chat IDs can trigger commands (existing allowedChatIds filter)
- `/restart` kills only claude processes, not arbitrary processes
- The restart script is scoped to the homaruscc project directory
- No remote code execution — commands are a fixed set, not arbitrary
