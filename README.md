# HomarUScc

**HomarUS for Claude Code** — an MCP server that gives Claude Code a body: messaging (Telegram), a web dashboard, persistent memory, scheduled timers, browser automation, and local tools.

Claude Code is the brain. HomarUScc is the nervous system.

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
                                    +-- Memory index (SQLite + vector + FTS + auto-flush + temporal decay + MMR diversity)
                                    +-- Browser automation (Playwright)
                                    +-- Identity manager (soul.md / user.md)
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

Edit `~/.homaruscc/config.json` with your settings. Tokens use `${ENV_VAR}` syntax so secrets stay in your `.env` file:

```bash
# ~/.homaruscc/.env
TELEGRAM_BOT_TOKEN=your-bot-token-here
```

### 3. Set up identity

HomarUScc loads `soul.md` and `user.md` from your identity directory to shape your assistant's personality and what it knows about you.

```bash
mkdir -p ~/.homaruscc/identity
cp identity.example/soul.md ~/.homaruscc/identity/soul.md
cp identity.example/user.md ~/.homaruscc/identity/user.md
```

Edit these to make it yours.

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
| `~/.homaruscc/browser-data/` | Persistent browser sessions |

## Event Loop

The `bin/event-loop` script provides a zero-token idle loop. It long-polls the dashboard HTTP API at the OS level — no Claude tokens are consumed while waiting. When events arrive, it returns control to Claude Code.

```bash
bash homaruscc/bin/event-loop
```

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
| `src/memory-index.ts` | SQLite + sqlite-vec hybrid search |
| `src/compaction-manager.ts` | Auto-flush memory before context compaction |
| `src/identity-manager.ts` | soul.md / user.md / overlay loader |
| `src/timer-service.ts` | Cron, interval, and one-shot timers |
| `src/browser-service.ts` | Playwright browser automation |
| `src/skill-manager.ts` | Hot-loadable skill plugins |
| `src/tool-registry.ts` | Tool registration and policy enforcement |
| `src/tools/` | Built-in tools (bash, fs, git, web, memory) |
| `dashboard/` | React + Vite SPA |

## License

MIT - see [LICENSE](LICENSE)
