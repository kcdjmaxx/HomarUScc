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
| `telegram_typing` | Send a typing indicator |
| `telegram_react` | React to a message with an emoji |
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
- CRM (People) — markdown-based contact manager with search, tags, connections, and linked document viewer
- Kanban — task board synced with the agent's task system

The dashboard is responsive — on mobile devices the sidebar collapses into a hamburger menu. Accessible remotely over Tailscale at `http://<your-tailscale-ip>:3120`.

### Apps Platform (planned)

The dashboard supports a pluggable apps system. The agent can build mini web apps on request (budget trackers, reading lists, dashboards) that live inside the dashboard UI:

- Apps live at `~/.homaruscc/apps/{slug}/` with a manifest, React component, and JSON data store
- Each app declares hooks (`read`, `write`, `describe`) exposed via a single `app_invoke` MCP tool
- The agent can query and update app state through hooks — "what's on my reading list?" triggers `app_invoke(slug=reading-list, hook=describe)`
- Apps are created by the agent via filesystem tools and auto-discovered on manifest scan

See `specs/apps-platform.md` and `design/crc-App*.md` for the full design.

### Dashboard Development

```bash
cd dashboard
npm install
npm run dev    # Dev server on :3121, proxies API to :3120
```

## Runtime Directories

HomarUScc creates runtime data that's gitignored and stays local. All user data lives under `local/` (one gitignore line):

| Directory | Purpose |
|-----------|---------|
| `local/user/context/` | Facts the assistant learns about you |
| `local/user/corrections/` | Corrections you've made (so it doesn't repeat mistakes) |
| `local/user/preferences/` | Your stated preferences |
| `local/system/` | System-level learned knowledge |
| `local/crm/` | CRM contact files (markdown + YAML frontmatter, see `crm.example/`) |
| `local/dreams/` | Dream cycle output (nightly, stored at 0.5x weight) |
| `local/research/` | Research notes stored by memory system |
| `local/docs/` | Private documents (outreach drafts, session notes, etc.) |
| `~/.homaruscc/memory/` | Vector + FTS search index (SQLite) |
| `~/.homaruscc/identity/` | Agent identity files (soul, user, state, preferences, disagreements) |
| `~/.homaruscc/journal/` | Daily reflection journal entries (indexed by memory system) |
| `~/.homaruscc/browser-data/` | Persistent browser sessions |

## Event Loop

The `bin/event-loop` script provides a zero-token idle loop. It long-polls the dashboard HTTP API at the OS level — no Claude tokens are consumed while waiting. When events arrive, it returns control to Claude Code.

```bash
bash homaruscc/bin/event-loop
```

### Identity Digest

Each wake delivers identity context so the agent stays in character. To avoid burning ~3K tokens on every event, the server uses two delivery modes:

- **Normal wake** (~200 tokens) — a compressed digest: agent name, core behavioral rules, and last session mood. Enough for personality consistency without the full payload.
- **Post-compaction wake** (~3K tokens) — full identity: `soul.md`, `user.md`, and `state.md`. Sent once after compaction when the original identity context has been compressed away.

The `PreCompact` hook sets a flag on the backend. The next `/api/wait` response checks the flag and returns the appropriate format. The flag is consumed once — subsequent wakes return the digest until the next compaction.

## Compaction Resilience

Claude Code compresses conversation history when the context window fills up. Without mitigation, the post-compaction agent loses track of what it was doing. HomarUScc handles this with two mechanisms:

**Session checkpoint** — Before compaction, the agent saves its current task context (topic, recent decisions, in-progress work, modified files, session texture, highlight snippets) to `~/.homaruscc/checkpoint.json` via `POST /api/checkpoint`. After compaction, the post-compact context injection includes this checkpoint so the new instance knows exactly where things left off. The checkpoint is cleared at session end. The `texture` field captures the session's conversational dynamic (e.g., "rapid shipping, playful, terse messages") and `highlights` preserves 2-3 raw exchange snippets that exemplify the vibe — restoring not just _what_ was happening but _how_ it felt.

**Delivery watermark** — The server tracks the timestamp of the last event delivered to Claude Code. After compaction, the event loop resumes from the watermark instead of replaying old events. This prevents the "bad loop" problem where a post-compaction agent re-handles messages it already responded to.

Both are wired into the `PreCompact` Claude Code hook that calls `/api/pre-compact`. Add this to your project's `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s http://127.0.0.1:3120/api/pre-compact"
          }
        ]
      }
    ]
  }
}
```

## Agent Dispatch

For tasks that would consume significant context (research, multi-file processing, mini-spec workflows), the agent can dispatch work to background agents instead of doing it inline:

1. Register the agent with `POST /api/agents` (returns 429 if at max capacity)
2. Spawn a background Task agent via Claude Code's Task tool
3. Return to the event loop immediately — stay responsive to messages
4. When the agent completes, an `agent_completed` event flows through the event system
5. Summarize results and send to the user

Max concurrent agents is configurable via `agents.maxConcurrent` in config (default 3). The agent registry tracks running/completed/failed agents and includes them in post-compaction context so background work isn't lost across compaction boundaries.

**Completion detection:** Agents signal completion by calling `POST /api/agents/:id/complete` with a result summary. This emits an `agent_completed` event that wakes the main event loop. A 30-minute timeout fallback catches agents that fail to call back. No polling needed — results arrive as events.

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
| `src/telegram-adapter.ts` | Telegram long-polling adapter (text, photos, documents, reactions, edits) |
| `src/dashboard-server.ts` | Express + WebSocket dashboard server |
| `src/dashboard-adapter.ts` | Dashboard channel adapter |
| `src/memory-index.ts` | SQLite + sqlite-vec hybrid search with dream-aware scoring |
| `src/compaction-manager.ts` | Auto-flush memory before context compaction |
| `src/session-checkpoint.ts` | Save/restore task context across compaction |
| `src/agent-registry.ts` | Track background agents with callback completion and timeout fallback |
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
