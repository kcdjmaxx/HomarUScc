# Advanced Features

This document covers HomarUScc's advanced subsystems: agent dispatch, compaction resilience, hot-loadable skills, browser automation, and external API integration patterns.

---

## Agent Dispatch System

The agent dispatch system offloads heavy or long-running tasks to background Claude Code agents while keeping the main event loop responsive.

### Architecture

The `AgentRegistry` (`src/agent-registry.ts`) tracks background agents in-memory. Each agent has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier |
| `description` | string | Human-readable description of the task |
| `status` | `running` / `completed` / `failed` / `timeout` | Current state |
| `startTime` | number | Epoch ms when the agent was registered |
| `result` | string? | Completion result (set on success) |
| `error` | string? | Error message (set on failure/timeout) |

Default concurrency limit: **3** agents. Default timeout: **30 minutes**. A background checker runs every 60 seconds to mark timed-out agents.

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents` | List all agents and their statuses |
| `POST` | `/api/agents` | Register a new agent (`{id, description}`) |
| `PATCH` | `/api/agents/:id` | Update agent status (`{status, result?, error?}`) |
| `DELETE` | `/api/agents/:id` | Clean up a finished agent |
| `POST` | `/api/agents/:id/complete` | Completion callback (`{result}` or `{error}`) |

### Dispatch Pattern

1. **Check capacity** -- `GET /api/agents` and verify fewer than `maxConcurrent` agents are running.

2. **Register the agent** with the backend:
```bash
curl -s -X POST http://127.0.0.1:3120/api/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"research-task-123","description":"Research widget pricing"}'
```

3. **Spawn a background Task agent** via Claude Code's Task tool with `run_in_background=true`.

4. **Resume the event loop** immediately -- don't wait for the agent to finish.

5. **Agent reports completion** by calling the callback URL:
```bash
curl -s -X POST http://127.0.0.1:3120/api/agents/research-task-123/complete \
  -H "Content-Type: application/json" \
  -d '{"result":"Found 3 pricing tiers..."}'
```

6. The registry emits an `agent_completed` event, which arrives in the next `/api/wait` response.

7. **Clean up** the agent entry: `DELETE /api/agents/research-task-123`.

### Dispatch Heuristics

| Handle inline | Dispatch to agent |
|---------------|-------------------|
| Quick replies and simple lookups | Research tasks (web search + synthesis) |
| Memory searches | Mini-spec workflows |
| Short messages | Multi-file reading/processing |
| Timer acknowledgments | Any task requiring 3+ tool calls |

### Agent Prompt Guidelines

Agent prompts should include:
- The specific task with all necessary context
- Pre-fetched memory search results
- File paths to read
- The completion callback URL and instructions

Agent prompts should NOT include:
- Soul/identity files (agents are workers, not the persona)
- Instructions to send messages directly (route through main loop)

---

## Session Checkpoints & Compaction Resilience

### What Compaction Is

Claude Code compacts context when the conversation grows too long, compressing earlier turns into a summary. This loses detailed state -- what you were working on, decisions made, the emotional texture of the session. HomarUScc provides mechanisms to preserve critical state across compaction boundaries.

### Session Checkpoint

The `SessionCheckpoint` (`src/session-checkpoint.ts`) stores rolling session state to disk at `~/.homaruscc/checkpoint.json`.

**Checkpoint fields:**

| Field | Purpose | Max items |
|-------|---------|-----------|
| `currentTopic` | What the session is about right now | 1 |
| `inProgressTask` | Active task description | 1 |
| `recentDecisions` | Decisions made this session | 10 |
| `recentMessages` | Recent message summaries | 5 |
| `modifiedFiles` | Files changed this session | unlimited |
| `texture` | First-person micro-journal of session quality | 1 |
| `highlights` | Raw exchange snippets exemplifying the session | 5 |
| `anchorPhrases` | Verbatim user quotes with emotional weight | 5 |

**Checkpoint API:**

```bash
# Update checkpoint (fields merge, arrays append with limits)
curl -s -X POST http://127.0.0.1:3120/api/checkpoint \
  -H "Content-Type: application/json" \
  -d '{"currentTopic":"refactoring timer system","recentDecisions":["switched to cron syntax"]}'

# Read current checkpoint
curl -s http://127.0.0.1:3120/api/checkpoint

# Clear checkpoint (at session end)
curl -s -X DELETE http://127.0.0.1:3120/api/checkpoint
```

### Compaction Manager

The `CompactionManager` (`src/compaction-manager.ts`) handles the pre- and post-compaction hooks that Claude Code calls.

**Pre-compaction hook** (`GET /api/pre-compact`):
- Fires once per compaction cycle (idempotent guard)
- Flushes the transcript buffer
- Auto-captures recent exchange highlights from the transcript
- Updates the session checkpoint with a timestamp
- Returns a prompt instructing Claude to save texture, anchor phrases, and session state
- If the event loop was active, includes a critical instruction to restart it after compaction

**Post-compaction hook** (`GET /api/post-compact`):
- Re-injects critical state: delivery watermark, active timers, memory stats, identity status
- Includes the full session checkpoint
- Lists any running background agents
- If the event loop was active, instructs immediate restart

### Identity Re-injection

The `/api/wait` endpoint adjusts its response based on whether compaction has occurred:

- **Normal wake** (`full: false`): Returns a compact identity digest (~200 tokens) -- name, core behavioral rules, last session mood.
- **Post-compaction wake** (`full: true`): Returns full soul.md, user.md, and state.md (~3K tokens) so the agent can fully re-adopt its persona.

The `consumeCompactionFlag()` method is consume-once: it returns `true` only on the first `/api/wait` call after compaction, then resets.

### Auto-Restart

The compaction counter persists across backend restarts at `~/.homaruscc/compaction-count.json`. After **8 compactions** (`MAX_COMPACTIONS`), the system signals `shouldRestart: true` in the `/api/wait` response. The event loop script detects this and instructs the user to run `bin/restart-claude` for a fresh Claude Code session.

---

## Skill System

Skills are hot-loadable extensions that register tools and handle events, managed by `SkillManager` (`src/skill-manager.ts`).

### Skill Structure

Each skill is a directory containing a `skill.json` manifest:

```
.claude/skills/my-skill/
  skill.json
  (optional: main.js, handler.ts, etc.)
```

### Skill Manifest (`skill.json`)

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "description": "What this skill does",
  "emits": ["custom_event_type"],
  "handles": ["telegram_message", "timer_fired"],
  "tools": [
    {
      "name": "my_custom_tool",
      "description": "Does something useful",
      "parameters": {
        "type": "object",
        "properties": {
          "input": { "type": "string" }
        },
        "required": ["input"]
      }
    }
  ],
  "process": {
    "command": "node",
    "args": ["main.js"],
    "port": 8900,
    "healthCheck": "/health"
  },
  "hooks": {
    "onStart": "setup.sh",
    "onStop": "cleanup.sh"
  }
}
```

### Transport Types

Skills communicate with the backend via one of three transports (`src/skill-transport.ts`):

| Transport | When used | Communication |
|-----------|-----------|---------------|
| `HttpSkillTransport` | `process.port` is set | HTTP POST to `localhost:{port}` |
| `StdioSkillTransport` | `process.command` is set (no port) | JSON lines over stdin/stdout |
| `DirectSkillTransport` | No `process` config | In-process function calls |

### Lifecycle

1. **Loading**: `SkillManager.loadAll()` scans configured `skills.paths` directories for subdirectories with `skill.json`.
2. **Registration**: Each skill's tools are registered with the `ToolRegistry`. Event handlers are wired to the `EventBus`.
3. **Hot-reload**: `startWatching()` uses `fs.watch` on search paths. When a skill directory changes, it unloads and reloads automatically.
4. **Unloading**: `unload()` removes tools from the registry and stops the skill process.

### Configuration

In `~/.homaruscc/config.json`:

```json
{
  "skills": {
    "paths": [".claude/skills"]
  }
}
```

---

## Browser Automation

HomarUScc integrates Playwright for browser automation via `BrowserService` (`src/browser-service.ts`) and seven MCP tools defined in `src/tools/browser.ts`.

### Setup

1. Install Playwright: `npx playwright install chromium`

2. Enable in config:
```json
{
  "browser": {
    "enabled": true,
    "headless": true,
    "viewport": { "width": 1280, "height": 720 },
    "timeout": 30000
  }
}
```

**Optional config fields:**

| Field | Default | Description |
|-------|---------|-------------|
| `headless` | `true` | Run browser without visible window |
| `executablePath` | (auto) | Custom Chromium binary path |
| `proxy` | (none) | Proxy server URL |
| `viewport` | `1280x720` | Browser viewport dimensions |
| `timeout` | `30000` | Default action timeout in ms |
| `userDataDir` | (none) | Path for persistent browser profile (cookies, sessions) |

### Lazy Launch

The browser is not started until the first tool call. `ensureBrowser()` launches Chromium on first use and reuses the same page for subsequent calls.

If `userDataDir` is set, a **persistent context** is used -- cookies, localStorage, and login sessions survive across browser restarts. Without it, each launch gets a clean ephemeral context.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `browser_navigate` | Navigate to a URL | `url` |
| `browser_snapshot` | Get accessibility tree of current page | (none) |
| `browser_screenshot` | Take PNG screenshot (base64) | (none) |
| `browser_click` | Click element by CSS selector | `selector` |
| `browser_type` | Type text into input by CSS selector | `selector`, `text` |
| `browser_evaluate` | Execute JavaScript in page | `script` |
| `browser_content` | Get text content of current page | (none) |

### Usage Pattern

```
browser_navigate: url="https://example.com"
browser_snapshot                        # Read the accessibility tree
browser_click: selector="#login-btn"    # Interact with elements
browser_type: selector="#email", text="user@example.com"
browser_evaluate: script="document.title"
browser_screenshot                      # Visual verification
```

---

## External API Integration Patterns

### The `run_tool` Pattern

The `run_tool` MCP tool delegates execution to any registered backend tool. This is the primary mechanism for extending HomarUScc with new capabilities without modifying the MCP protocol layer.

```
run_tool: name="bash", params={"command": "curl -s https://api.example.com/data"}
run_tool: name="web_fetch", params={"url": "https://example.com"}
run_tool: name="web_search", params={"query": "latest news"}
```

Available tools include: `bash`, `read`, `write`, `edit`, `glob`, `grep`, `git`, `web_fetch`, `web_search`, and all memory/telegram/timer tools.

### Adding a New API Integration

The recommended pattern for adding external APIs:

1. **Create a plugin** in `plugins/` or a tool file in `src/tools/`:

```typescript
// src/tools/my-api.ts
import type { ToolDefinition, ToolResult } from "../types.js";

export function createMyApiTools(config: MyApiConfig): ToolDefinition[] {
  return [{
    name: "my_api_fetch",
    description: "Fetch data from My API",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" }
      },
      required: ["query"]
    },
    source: "builtin",
    async execute(params: unknown): Promise<ToolResult> {
      const { query } = params as { query: string };
      // API call logic here
      return { output: JSON.stringify(result) };
    }
  }];
}
```

2. **Register the tools** in the MCP tools list (via `src/mcp-tools.ts` or as a plugin).

3. **Store credentials** in `~/.homaruscc/.env` or `~/.homaruscc/secrets/`:
```
MY_API_KEY=your-key-here
```

4. **Reference secrets in config** using `${VAR}` interpolation:
```json
{
  "myApi": {
    "apiKey": "${MY_API_KEY}"
  }
}
```

The `Config` class (`src/config.ts`) resolves `${VAR_NAME}` patterns in config values against environment variables. It also loads `.env` files from the same directory as the config file.

### Config Environment Variable Resolution

Config values can reference environment variables:

```json
{
  "channels": {
    "telegram": {
      "token": "${TELEGRAM_BOT_TOKEN}"
    }
  }
}
```

The `resolveEnvVars()` method recursively replaces `${VAR_NAME}` patterns in all string values throughout the config tree.

### Config Hot-Reload

The config system supports watching for changes via `startWatching()`. Changes to "safe" keys (memory search weights, skill paths, timer/dashboard enabled flags) are applied without restart. Changes to other keys (channels, identity) log a warning that a restart is needed.

---

## Related Documentation

- [Architecture](architecture.md) -- system design and component overview
- [Configuration](configuration.md) -- config file reference
- [Operations](operations.md) -- monitoring, troubleshooting, and maintenance
- [Security](security.md) -- permission boundaries and safety rules
