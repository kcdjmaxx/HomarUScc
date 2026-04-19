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
  getCompactionStats: () => { count: number; loopFailures: number; pending: unknown };
  getLastWaitPoll: () => number;  // timestamp of last /api/wait call
  projectDir: string;
  sendTelegram: (chatId: string, text: string) => Promise<void>;

  // ACC hooks (backend glue into ConflictMonitor)
  logMissedConflict?: (domain: string, description: string) => number;
  resolveConflict?: (
    id: number,
    resolution: string,
  ) => { ok: boolean; status: "resolved" | "not_found" | "already_resolved"; summary?: string };
  listOpenConflicts?: (limit?: number) => Array<{ id: number; domain: string; severity: string; description: string }>;
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

### `/compaction`
- Calls `ctx.getCompactionStats()` for session compaction counter
- Reports count, loop failures, and any pending flag

### `/restart`
- Sends "Restarting Claude Code..." acknowledgment
- Spawns `bin/restart-claude` as detached child process
- The script handles killing old claude + starting new session
- Reports result back via Telegram after script completes

### `/nuke`
- Broader recovery than `/restart` — kills **all** Claude processes system-wide
- Spawns `bin/nuke-claude` as detached child process
- Use when `/restart` leaves orphaned processes

### `/missed <description>`
- Logs an ACC recall failure via `ctx.logMissedConflict(domain, description)`
- Domain heuristic: keywords in the description (max/user → user-intent; caul/soul/identity → identity; dream → dream; else general)
- Writes to `missed_conflict_log` table for recall tracking; surfaces in weekly reconsolidation

### `/resolve [<id> <note>]`
- With no args: calls `ctx.listOpenConflicts(10)` and formats `#<id> [<severity>/<domain>] <description>` lines plus usage
- With `<id> <note>`: calls `ctx.resolveConflict(id, note)`, which routes to `ConflictMonitor.resolveById` with `source="user"`. Validates existence and not-already-resolved, replying appropriately for each case.
- Completes the ACC resolver loop alongside the search-path auto-resolver and the decay safety net (BUG-20260419-4)

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
