# Sequence: Telegram Slash Command

**Spec:** specs/telegram-commands.md
**CRC:** crc-TelegramCommandHandler.md

## /status Flow

```
Telegram API
  │ getUpdates → message: "/status"
  ▼
TelegramChannelAdapter.poll()
  │ allowedChatIds check (existing) ✓
  │ text starts with "/" → delegate to command handler
  ▼
TelegramCommandHandler.tryHandle(chatId, "/status")
  │ parse command name: "status"
  │ lookup in commands map → found
  │ call handler(chatId, "", ctx)
  ▼
statusHandler()
  │ ctx.getStatus() → { channels, timers, memory }
  │ ctx.getLastWaitPoll() → timestamp
  │ format status message
  │ return formatted string
  ▼
TelegramChannelAdapter
  │ result.handled = true
  │ send(chatId, { text: statusMessage })
  │ return (NO event delivery to queue)
  ▼
Telegram API ← sendMessage
```

## /restart Flow

```
Telegram API
  │ getUpdates → message: "/restart"
  ▼
TelegramChannelAdapter.poll()
  │ allowedChatIds ✓, starts with "/" → command handler
  ▼
TelegramCommandHandler.tryHandle(chatId, "/restart")
  │ parse: "restart"
  │ call restartHandler(chatId, "", ctx)
  ▼
restartHandler()
  │ return "Restarting Claude Code..." (immediate ack)
  │
  │ spawn("bash", ["bin/restart-claude"], { detached: true, stdio: "ignore" })
  │   └─ bin/restart-claude:
  │       1. pkill -f "claude.*homaruscc" (kill old session)
  │       2. sleep 1
  │       3. Start new claude session (method TBD — see Design Notes)
  │       4. curl POST /api/restart-result with success/failure
  │
  ▼
TelegramChannelAdapter
  │ send(chatId, "Restarting Claude Code...")
  │ return (suppressed)
  ▼
[... time passes ...]
  ▼
bin/restart-claude completes
  │ POST /api/restart-result { success: true/false, message: "..." }
  ▼
DashboardServer
  │ receives restart result
  │ emits event → Telegram send: "Claude Code restarted" or "Restart failed: ..."
```

## Unknown Command Flow

```
Telegram API
  │ getUpdates → message: "/remind me about meeting"
  ▼
TelegramChannelAdapter.poll()
  │ text starts with "/" → command handler
  ▼
TelegramCommandHandler.tryHandle(chatId, "/remind me about meeting")
  │ parse: "remind"
  │ lookup in commands map → NOT found
  │ return { handled: false }
  ▼
TelegramChannelAdapter.handleMessage()
  │ falls through to normal event delivery
  │ deliverWithTarget({ text: "/remind me about meeting", ... })
  ▼
EventQueue → Claude handles it as normal message
```

## Design Notes

### Claude Session Restart Method

Open question: how to start an interactive Claude Code session from a script. Options:

1. **Terminal.app via osascript** (macOS only):
   ```bash
   osascript -e 'tell app "Terminal" to do script "cd $DIR && claude"'
   ```

2. **tmux session** (cross-platform):
   ```bash
   tmux new-session -d -s homaruscc "cd $DIR && claude"
   ```

3. **`claude -p` with long prompt** (non-interactive, limited):
   ```bash
   claude -p "/homaruscc" --permission-mode bypassPermissions --cwd "$DIR"
   ```
   Problem: `-p` mode exits after one response. The event loop needs ongoing interaction.

4. **`claude --input-format stream-json`** (pipe-based):
   Could pipe events from a wrapper process. Most architecturally clean but highest effort.

Recommend **option 2 (tmux)** — it's reliable, works headless, and Max can `tmux attach -t homaruscc` to inspect the session. Falls back to option 1 if tmux isn't available.

### Restart Result Callback

The restart script calls back to the backend when done:
```bash
curl -s -X POST http://127.0.0.1:3120/api/restart-result \
  -H "Content-Type: application/json" \
  -d '{"success":true,"pid":12345}'
```

The backend holds the original chatId and sends the result via Telegram.
