# CRC: TelegramCommandHandler

**Source:** `src/telegram-command-handler.ts`
**Spec:** specs/telegram-commands.md

## Responsibility

Intercepts Telegram messages starting with `/` and routes them to registered command handlers. Commands execute inside the backend process — no Claude involvement. Unknown commands pass through as normal events.

## Collaborators

- **TelegramChannelAdapter** — calls `tryHandleCommand()` before delivering messages to the event queue
- **HomarUScc** — provides access to subsystems (status, channels, memory stats) for command responses
- **DashboardServer** — provides last event-loop poll timestamp to determine Claude liveness

## State

- `commands: Map<string, CommandHandler>` — registered slash command handlers
- `CommandHandler = (chatId: string, args: string, ctx: CommandContext) => Promise<string>`
- `CommandContext` — bag of references to backend subsystems (homaruscc instance, config, etc.)

## Interface

```typescript
interface CommandContext {
  getStatus: () => StatusResponse;
  getLastWaitPoll: () => number;  // timestamp of last /api/wait call
  projectDir: string;
}

type CommandHandler = (chatId: string, args: string, ctx: CommandContext) => Promise<string>;

class TelegramCommandHandler {
  register(name: string, handler: CommandHandler): void;
  tryHandle(chatId: string, text: string): Promise<{ handled: boolean; reply?: string }>;
}
```

## Commands

### `/ping`
- Returns "pong" immediately
- Validates backend is alive and Telegram send works

### `/status`
- Calls `ctx.getStatus()` for system health
- Checks `ctx.getLastWaitPoll()` — if >120s ago, reports Claude as disconnected
- Formats a compact status message with emoji indicators

### `/restart`
- Sends "Restarting Claude Code..." acknowledgment
- Spawns `bin/restart-claude` as detached child process
- The script handles killing old claude + starting new session
- Reports result back via Telegram after script completes

## Integration Point

In `TelegramChannelAdapter.handleMessage()`, before the existing event delivery logic:

```typescript
if (msg.text?.startsWith("/")) {
  const result = await this.commandHandler.tryHandle(chatId, msg.text);
  if (result.handled) {
    if (result.reply) await this.send(chatId, { text: result.reply });
    return; // suppress event delivery
  }
}
```

## Design Notes

- Commands run synchronously in the adapter's poll loop — keep them fast
- `/restart` is the exception: it spawns a child process and returns immediately
- The command registry is populated during backend startup, not dynamically
- Only works for allowed chat IDs (existing security filter runs first)
