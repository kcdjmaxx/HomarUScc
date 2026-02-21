# HomarUScc

**An MCP server that gives Claude Code a body** — messaging, memory, identity, timers, browser automation, and tools. Claude Code is the brain. HomarUScc is the nervous system.

Most MCP servers add capabilities. HomarUScc adds _continuity_. It gives the agent persistent identity (who it is across sessions), evolving memory (what it's learned), and zero-token idle (it costs nothing when nobody's talking to it). The agent wakes on events, reasons, responds, reflects, and goes back to sleep.

The result is an agent that remembers yesterday's conversation, carries forward its own preferences and opinions, writes a daily journal, dreams overnight, and can modify its own personality file as it develops. Not a chatbot that resets every session — a persistent presence that grows over time.

Built with [mini-spec](https://github.com/zot/mini-spec).

## How It Works

```
Claude Code <-> MCP (stdio) <-> Proxy (mcp-proxy.ts)
                                    |  auto-spawns + HTTP forwarding
                                    v
                              Backend (backend.ts)
                                    |
                                    +-- Telegram (long-polling adapter)
                                    +-- Dashboard (Express + WebSocket SPA)
                                    +-- Timer service (cron / interval / one-shot)
                                    +-- Memory index (SQLite + vector + FTS + decay + MMR + dream scoring)
                                    +-- Browser automation (Playwright)
                                    +-- Identity manager (soul.md / user.md / state.md + journal)
                                    +-- Session checkpoint (compaction resilience)
                                    +-- Agent registry (background task dispatch)
                                    +-- Skill plugins (hot-loadable)
                                    +-- Tool registry (bash, fs, git, web, memory)
```

The proxy is thin and never restarts. The backend can be restarted (via `restart_backend` tool) for self-improvement without dropping the MCP connection.

Events arrive from channels (Telegram messages, dashboard chat, timer fires) and flow into the event loop. HomarUScc sends MCP notifications to Claude Code, which reasons about them and calls MCP tools to respond.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Node.js >= 22
- (Optional) Ollama for local embeddings
- (Optional) Playwright for browser automation

## Installation

### 1. Clone and build

```bash
git clone https://github.com/kcdjmaxx/HomarUScc.git
cd HomarUScc
npm install
npm run build
```

### 2. Configure

```bash
mkdir -p ~/.homaruscc
cp config.example.json ~/.homaruscc/config.json
```

Edit `~/.homaruscc/config.json` with your settings (see `config.example.json` for all options including default timers and browser config). Tokens use `${ENV_VAR}` syntax so secrets stay in your `.env` file:

```bash
cp .env.example ~/.homaruscc/.env
# Edit ~/.homaruscc/.env with your actual tokens
```

### 3. Set up identity

HomarUScc loads identity files from `~/.homaruscc/identity/` to shape your assistant's personality, what it knows about you, and its evolving self-knowledge.

```bash
mkdir -p ~/.homaruscc/identity
cp identity.example/*.md ~/.homaruscc/identity/
```

Edit `soul.md` (agent personality) and `user.md` (what the agent knows about you) to make it yours. The starter kit includes templates for all five identity files. The agent updates them over time:

| File | Purpose | Who writes it |
|------|---------|---------------|
| `soul.md` | Core identity, values, self-evolution | Human (core) + Agent (below Self-Evolution line) |
| `user.md` | User context and preferences | Human |
| `state.md` | Session mood, unresolved items, emotional continuity | Agent (end of each session) |
| `preferences.md` | Emergent preferences discovered through experience | Agent (during reflection) |
| `disagreements.md` | Times the agent pushed back or had a different opinion | Agent (when it happens) |

Journal entries are written to `~/.homaruscc/journal/YYYY-MM-DD.md` during daily reflection.

### Dream Cycle

At 3am each night, the agent runs a three-phase dream cycle inspired by [neuroscience research on sleep functions](dreams.md):

1. **Memory consolidation** — reviews recent memories, identifies what's important vs noise
2. **Associative dreaming** — pulls random memories from different topics/periods and force-connects them, producing fuzzy, impressionistic fragments
3. **Overfitting prevention** — challenges an established preference or belief to test its flexibility

Dream output is deliberately stream-of-consciousness and stored in the unified memory index under `dreams/` with 0.5x weight (always ranks below waking memories) and a 7-day decay half-life (fades quickly). When dream fragments surface during waking interactions, the agent notes the origin explicitly.

A morning digest summarizes interesting dream fragments via Telegram.

The waking personality loop and dream cycle run on different timescales but feed into each other:

```
                WAKING LOOP                          DREAM CYCLE (3am)
                ==========                           =================

        ┌─→ Experience ──────────────────────────→ Raw material for dreams
        │       |                                         |
        │       v                                         v
        │   Memory ←──────────── Memory Consolidation ────┘
        │       |                (re-rank, strengthen,     |
        │       |                 let weak ones decay)     |
        │       v                                         v
        │   Reflection ←──────── Emotional Processing ────┘
        │       |                (revisit charged moments  |
        │       |                 from new angles)         |
        │       v                                         v
        │   Self-knowledge ←──── Overfitting Prevention ──┘
        │       |                (challenge established    |
        │       |                 patterns/preferences)    |
        │       v                                         v
        │   Identity ←────────── Associative Dreaming ────┘
        │   evolution            (novel connections feed
        │       |                 into convictions,
        │       v                 soul.md evolution)
        └── Changed
            behavior
```

The waking loop is **fast and reactive** — every interaction triggers observe, reflect, learn, evolve, act differently. The dream cycle is **slow and integrative** — once per night, processing the accumulated day into deeper patterns. This dual-timescale architecture mirrors how human memory consolidation works: waking learning is specific, sleep consolidation is general.

### 4. Add to Claude Code

Register HomarUScc as an MCP server in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "homaruscc": {
      "command": "node",
      "args": ["/absolute/path/to/HomarUScc/dist/mcp-proxy.js"],
      "env": {
        "HOMARUSCC_CONFIG": "~/.homaruscc/config.json"
      }
    }
  }
}
```

Restart Claude Code. HomarUScc's tools will appear automatically. The proxy auto-spawns the backend process — no manual startup needed.

## MCP Tools

| Tool | Description |
|------|-------------|
| `telegram_send` | Send a message to a Telegram chat |
| `telegram_read` | Read recent incoming messages |
| `memory_search` | Hybrid vector + full-text search over stored content |
| `memory_store` | Store and index content for later retrieval |
| `timer_schedule` | Schedule cron, interval, or one-shot timers |
| `timer_cancel` | Cancel a scheduled timer |
| `dashboard_send` | Send a message to the web dashboard |
| `get_status` | System status (channels, memory, timers, queue) |
| `get_events` | Recent event history |
| `wait_for_event` | Long-poll for events (blocks until something happens) |
| `browser_navigate` | Navigate to a URL |
| `browser_snapshot` | Get the accessibility tree of the current page |
| `browser_screenshot` | Take a screenshot (base64 PNG) |
| `browser_click` | Click an element by CSS selector |
| `browser_type` | Type into an input by CSS selector |
| `browser_evaluate` | Execute JavaScript in the page |
| `browser_content` | Get page text content |
| `run_tool` | Execute any registered tool (bash, read, write, edit, glob, grep, git, web) |

## MCP Resources

| URI | Description |
|-----|-------------|
| `identity://soul` | Soul.md content |
| `identity://user` | User.md content |
| `identity://state` | State.md — agent mood, session continuity |
| `config://current` | Current config (secrets redacted) |
| `events://recent` | Recent event history |

## Dashboard

When enabled, the dashboard runs on `http://localhost:3120` with:

- Chat interface (messages route through Claude Code via MCP)
- Real-time event log via WebSocket
- System status panel
- Memory search browser

### Dashboard Development

```bash
cd dashboard
npm install
npm run dev    # Dev server on :3121, proxies API to :3120
```

## Runtime Directories

HomarUScc creates runtime data that's gitignored and stays local:

| Directory | Purpose |
|-----------|---------|
| `user/context/` | Facts the assistant learns about you |
| `user/corrections/` | Corrections you've made (so it doesn't repeat mistakes) |
| `user/preferences/` | Your stated preferences |
| `system/` | System-level learned knowledge |
| `~/.homaruscc/memory/` | Vector + FTS search index (SQLite) |
| `~/.homaruscc/identity/` | Agent identity files (soul, user, state, preferences, disagreements) |
| `~/.homaruscc/journal/` | Daily reflection journal entries (indexed by memory system) |
| `~/.homaruscc/browser-data/` | Persistent browser sessions |

## Event Loop

The `bin/event-loop` script provides a zero-token idle loop. It long-polls the dashboard HTTP API at the OS level — no Claude tokens are consumed while waiting. When events arrive, it returns control to Claude Code.

```bash
bash homaruscc/bin/event-loop
```

## Compaction Resilience

Claude Code compresses conversation history when the context window fills up. Without mitigation, the post-compaction agent loses track of what it was doing. HomarUScc handles this with two mechanisms:

**Session checkpoint** — Before compaction, the agent saves its current task context (topic, recent decisions, in-progress work, modified files) to `~/.homaruscc/checkpoint.json` via `POST /api/checkpoint`. After compaction, the post-compact context injection includes this checkpoint so the new instance knows exactly where things left off. The checkpoint is cleared at session end.

**Delivery watermark** — The server tracks the timestamp of the last event delivered to Claude Code. After compaction, the event loop resumes from the watermark instead of replaying old events. This prevents the "bad loop" problem where a post-compaction agent re-handles messages it already responded to.

Both are wired into the existing `PreCompact`/`PostCompact` Claude Code hooks that call `/api/pre-compact` and `/api/post-compact`.

## Agent Dispatch

For tasks that would consume significant context (research, multi-file processing, mini-spec workflows), the agent can dispatch work to background agents instead of doing it inline:

1. Register the agent with `POST /api/agents` (returns 429 if at max capacity)
2. Spawn a background Task agent via Claude Code's Task tool
3. Return to the event loop immediately — stay responsive to messages
4. When the agent completes, an `agent_completed` event flows through the event system
5. Summarize results and send to the user

Max concurrent agents is configurable via `agents.maxConcurrent` in config (default 3). The agent registry tracks running/completed/failed agents and includes them in post-compaction context so background work isn't lost across compaction boundaries.

## Architecture

HomarUScc is a fork of HomarUS with the agent loop, model router, and HTTP API removed. Claude Code handles all reasoning; HomarUScc just provides the I/O layer.

Key source files:

| File | Purpose |
|------|---------|
| `src/homaruscc.ts` | Event loop orchestrator |
| `src/mcp-proxy.ts` | MCP stdio proxy — auto-spawns backend, forwards tool calls over HTTP |
| `src/backend.ts` | Standalone backend process (Telegram, timers, dashboard, memory) |
| `src/mcp-server.ts` | Legacy single-process MCP server (unused in two-process mode) |
| `src/mcp-tools.ts` | MCP tool definitions |
| `src/mcp-resources.ts` | MCP resource definitions |
| `src/config.ts` | Config loader with env var resolution and hot-reload |
| `src/telegram-adapter.ts` | Telegram long-polling adapter |
| `src/dashboard-server.ts` | Express + WebSocket dashboard server |
| `src/dashboard-adapter.ts` | Dashboard channel adapter |
| `src/memory-index.ts` | SQLite + sqlite-vec hybrid search with dream-aware scoring |
| `src/compaction-manager.ts` | Auto-flush memory before context compaction |
| `src/session-checkpoint.ts` | Save/restore task context across compaction |
| `src/agent-registry.ts` | Track background agents with capacity limits |
| `src/transcript-logger.ts` | Session transcript capture and indexing |
| `src/identity-manager.ts` | Identity loader (soul.md, user.md, state.md) |
| `src/timer-service.ts` | Cron, interval, and one-shot timers |
| `src/browser-service.ts` | Playwright browser automation |
| `src/skill-manager.ts` | Hot-loadable skill plugins |
| `src/tool-registry.ts` | Tool registration and policy enforcement |
| `src/tools/` | Built-in tools (bash, fs, git, web, memory) |
| `dashboard/` | React + Vite SPA |

## License

MIT - see [LICENSE](LICENSE)
