# HomarUS vs HomarUScc — Gap Analysis

**Date:** 2026-02-24
**Method:** Source-level comparison of all `.ts` files in both repos

## Executive Summary

HomarUS is a standalone, self-contained AI agent coordinator with its own model routing, agent spawning, and inference loop. HomarUScc is a derivative that strips out the autonomous agent brain and replaces it with Claude Code as the reasoning engine, communicating via MCP (Model Context Protocol). This architectural pivot means HomarUScc intentionally lacks some HomarUS features (they would be redundant), but has gained several capabilities HomarUS does not have.

**Key finding:** The 4 real gaps where HomarUS has something HomarUScc truly lacks are: (1) unit tests, (2) the LSP tool, (3) auth-token-secured HTTP API, and (4) the `install-daemon` CLI command. Everything else is either intentionally different (model/agent layer) or HomarUScc already has a superior equivalent.

---

## 1. Features HomarUS Has That HomarUScc Does NOT

### 1.1 Full Model Router and Provider System (INTENTIONALLY ABSENT)

| Component | HomarUS Source | HomarUScc Equivalent |
|-----------|---------------|---------------------|
| `ModelRouter` class | `src/model-router.ts` | None |
| `ModelProvider` abstract class | `src/model-provider.ts` | None |
| `OpenAICompatibleProvider` | `src/model-provider.ts` | None |
| `AnthropicProvider` | `src/model-provider.ts` | None |
| Model aliases & resolution | `ModelRouter.resolve()` | None |
| Fallback chain | `ModelRouter.chat()` | None |
| Token usage tracking & budgets | `ModelRouter.trackUsage()`, `checkBudget()` | None |
| Auth profile rotation | `ModelRouter.rotateAuthProfile()` | None |
| Failover logic (rotate/next/compact) | `ModelRouter.failover()` | None |

**Assessment:** INTENTIONALLY ABSENT. HomarUScc delegates all inference to Claude Code. There is no need for model routing because Claude Code handles model selection, token management, and failover. This is the core architectural difference. NOT a gap to close.

### 1.2 Agent System (INTENTIONALLY ABSENT)

| Component | HomarUS Source | HomarUScc Equivalent |
|-----------|---------------|---------------------|
| `Agent` class (agentic loop) | `src/agent.ts` | None |
| `AgentManager` (spawn/cancel/waitForAll) | `src/agent-manager.ts` | `AgentRegistry` (tracking only) |
| `ExecutionStrategy` interface | `src/execution-strategy.ts` | None |
| `EmbeddedStrategy` | `src/execution-strategy.ts` | None |
| `SubprocessStrategy` | `src/subprocess-strategy.ts` | None |
| `agent-worker.ts` (child process) | `src/agent-worker.ts` | None |
| Concurrent agent spawning | `AgentManager.spawn()` | None (Claude Code is the single agent) |
| Agent circuit breaker | `Agent.run()` (maxConsecutiveErrors) | None |
| Agent progress/complete/error events | `Agent.emitProgress()` etc. | `AgentRegistry` emits similar events |

**Assessment:** INTENTIONALLY ABSENT. In HomarUS, the system spawns its own agents that call LLM APIs and execute tool loops. In HomarUScc, Claude Code IS the agent. The `AgentRegistry` in HomarUScc is a lightweight tracker for background tasks spawned by Claude Code (e.g., `claude -p` subprocesses), not an autonomous agent system. NOT a gap to close.

### 1.3 LSP Tool (REAL GAP)

**HomarUS source:** `src/tools/lsp.ts`
**HomarUScc:** Nothing

HomarUS includes a code intelligence tool that provides:
- Find definition (pattern-matching based, not a real language server)
- Find references
- Hover info (JSDoc extraction)
- Document symbols
- Workspace symbols
- Basic diagnostics (bracket matching, TODO/FIXME detection)

This tool works without a running language server by using regex-based pattern matching.

**Assessment:** MINOR GAP. Claude Code already has built-in code intelligence through its own file reading and grep tools. The LSP tool's pattern-matching approach is a convenience but not strictly necessary when the agent can read files and use grep. However, the `symbols` operation (listing all classes/functions/methods in a file) could be useful as a quick structural overview tool. **Low priority to port.**

### 1.4 Unit Tests (REAL GAP)

**HomarUS files:**
- `src/homarus.test.ts` — EventBus + EventQueue integration tests
- `src/agent-manager.test.ts` — Agent spawning and lifecycle tests
- `src/browser-manager.test.ts` — Browser manager tests
- `src/model-router.test.ts` — Model resolution, fallback chain, budget tests
- `src/skill-manager.test.ts` — Skill loading and lifecycle tests
- Uses Vitest (configured in both projects' `package.json`)

**HomarUScc:** No test files exist. The `test` script is configured in `package.json` but there are no `.test.ts` files.

**Assessment:** REAL GAP. HomarUScc has zero unit tests. While some of the HomarUS tests cover components that don't exist in HomarUScc (like ModelRouter), the core event loop, memory index, timer service, and tool registry all lack test coverage. **Medium priority.**

### 1.5 Config Schema Validation (POTENTIAL GAP)

**HomarUS:** Lists `ajv` (JSON Schema validator) as a dependency in `package.json`, though it does not appear to be imported in any current source file — it may be planned or used by a skill.
**HomarUScc:** No `ajv` dependency. Config is loaded and merged but never validated against a schema.

**Assessment:** NEGLIGIBLE GAP. Neither project actually validates config against a JSON schema at startup. Both do best-effort merging with defaults. **Very low priority.**

### 1.6 CLI `install-daemon` Command (REAL GAP)

**HomarUS source:** `src/cli.ts` — `installDaemon()` function

HomarUS can generate:
- macOS LaunchAgent plist (`~/Library/LaunchAgents/com.homarus.plist`)
- Linux systemd user service (`~/.config/systemd/user/homarus.service`)

These enable the agent to start automatically at login/boot.

**HomarUScc:** No equivalent. The `cli.ts` runs the wizard and then the MCP proxy, but has no daemon installation capability.

**Assessment:** REAL GAP. HomarUScc runs as an MCP server within Claude Code, so daemonization is less relevant (it starts when Claude Code starts). However, for standalone backend mode, an `install-daemon` command would be useful. **Low priority** — the two-process architecture means the proxy starts with Claude Code, and the backend is spawned by the proxy.

### 1.7 Auth-Protected HTTP API (REAL GAP)

**HomarUS source:** `src/http-api.ts` — `validateAuth()` method checks `Authorization: Bearer <token>`
**HomarUS config:** `server.auth.token` in config

**HomarUScc:** The DashboardServer has no authentication on any endpoint. Anyone on the local network can call `/api/tool-call`, `/api/events`, etc.

**Assessment:** MINOR GAP. HomarUScc currently runs on localhost, and the dashboard is intended for local use. However, if the port is exposed (e.g., via Tailscale), any peer could invoke tools. **Low priority for local use, higher if exposing remotely.**

### 1.8 CLI `status` and `config` Commands (MINOR GAP)

**HomarUS source:** `src/cli.ts`
- `status` — Fetches `/status` from a running instance
- `config` — Validates config file without starting the loop

**HomarUScc:** CLI only has `init` (wizard) and default (start MCP server). No `status` or `config validate` commands.

**Assessment:** MINOR GAP. Status is available via the dashboard API (`/api/status`). A CLI shortcut would be convenient but not critical. **Very low priority.**

### 1.9 Standalone Server Mode (HTTP API)

**HomarUS source:** `src/http-api.ts` — Full REST API with `/health`, `/status`, `/events` endpoints. Designed to run as a standalone service that skills and external systems POST events to.

**HomarUScc:** The DashboardServer serves a similar role but is designed specifically for the MCP proxy architecture, not as a general-purpose event ingestion API.

**Assessment:** DIFFERENT DESIGN, not a gap. HomarUScc's dashboard server covers the same functionality through different routes (`/api/health`, `/api/status`, `/api/events`). The ingestion path differs: HomarUS has `/events` for POSTing arbitrary events; HomarUScc receives events through channel adapters and timers.

### 1.10 `registerAgentHandler` Pattern

**HomarUS source:** `src/homarus.ts` — `registerAgentHandler()` allows binding event types to agent configs, so incoming events auto-spawn agents with specific models/tools/prompts.

**HomarUScc:** Events are routed to Claude Code via MCP notifications instead. No agent auto-spawning.

**Assessment:** INTENTIONALLY ABSENT. Claude Code decides how to handle events. NOT a gap.

---

## 2. Features HomarUScc Has That HomarUS Does NOT

### 2.1 Two-Process MCP Architecture

| Component | HomarUScc Source | HomarUS Equivalent |
|-----------|-----------------|-------------------|
| `mcp-proxy.ts` — thin MCP stdio proxy | `src/mcp-proxy.ts` | None |
| `backend.ts` — restartable backend | `src/backend.ts` | None |
| `restart_backend` tool | `src/mcp-proxy.ts` | None |
| WebSocket relay (proxy <-> backend) | `src/mcp-proxy.ts` | None |

**This is the signature HomarUScc innovation.** The MCP proxy never restarts (keeps the Claude Code connection alive), while the backend can be restarted for code changes or recovery. HomarUS is a single monolithic process.

### 2.2 Web Dashboard (Full UI)

| Component | HomarUScc Source | HomarUS Equivalent |
|-----------|-----------------|-------------------|
| `DashboardServer` | `src/dashboard-server.ts` | `HttpApi` (REST only, no UI) |
| `DashboardAdapter` (channel) | `src/dashboard-adapter.ts` | None |
| WebSocket real-time events | `DashboardServer.setupWebSocket()` | None |
| Built React dashboard | `dashboard/` directory | None |
| Dashboard chat | `DashboardServer.handleWsMessage()` | None |
| Memory search via dashboard | WebSocket `search` handler | None |

HomarUScc ships a full React-based web dashboard with:
- Real-time event stream
- Chat interface (bidirectional via DashboardAdapter)
- Memory search
- Status monitoring
- Static file serving for apps

### 2.3 MCP Resources

**HomarUScc source:** `src/mcp-resources.ts`

Exposes read-only resources to Claude Code:
- `identity://soul` — soul.md content
- `identity://user` — user.md content
- `identity://state` — agent state
- `config://current` — redacted config
- `events://recent` — recent event history

HomarUS has no MCP integration at all (it does not speak MCP protocol).

### 2.4 Compaction Manager

**HomarUScc source:** `src/compaction-manager.ts`

Handles Claude Code context compaction (when conversation gets too long):
- Pre-compact hook: flushes transcripts, saves session checkpoint, generates instructions for preserving texture
- Post-compact hook: re-injects critical state (timers, memory stats, checkpoint, active agents)
- Tracks compaction count (persisted across restarts)
- Detects event loop restart failures after compaction
- "Texture preservation" — prompts for micro-journal, anchor phrases, exchange highlights

This is entirely specific to the Claude Code integration pattern. HomarUS doesn't need it because it manages its own context windows.

### 2.5 Session Checkpoint

**HomarUScc source:** `src/session-checkpoint.ts`

Persists session state across compactions:
- Current topic, recent decisions, in-progress task
- Recent messages, modified files
- **Texture** — subjective session quality micro-journal
- **Highlights** — raw exchange snippets
- **Anchor phrases** — verbatim user quotes

This is a continuity mechanism for surviving Claude Code's context compaction.

### 2.6 Transcript Logger

**HomarUScc source:** `src/transcript-logger.ts`

Captures all inbound/outbound messages across channels:
- Buffers turns in memory
- Periodically flushes to date-stamped markdown files (`~/.homaruscc/transcripts/YYYY-MM-DD.md`)
- Indexes flushed files into memory for searchability
- Buffer retention on flush failure
- Pre-compaction auto-flush

HomarUS has no transcript capture.

### 2.7 Agent Registry (Lightweight Background Task Tracker)

**HomarUScc source:** `src/agent-registry.ts`

Tracks background tasks spawned by Claude Code:
- Register/complete/fail/timeout lifecycle
- Max concurrent limit
- Periodic timeout checking
- Emits events on completion/failure
- REST API for management (`/api/agents/`)
- Callback endpoint (`/api/agents/:id/complete`)

This is different from HomarUS's `AgentManager` — it doesn't spawn or run agents, just tracks them.

### 2.8 Setup Wizard (On-Birth Experience)

**HomarUScc source:** `src/wizard.ts`, `src/scaffolder.ts`, `src/claude-code-registrar.ts`

Interactive first-run experience:
- Agent name prompt
- Channel selection (dashboard always-on, Telegram optional)
- Identity path choice: Alignment Generator (opens browser) or template
- Multi-line soul.md paste support
- User context collection
- Telegram token prompt
- Auto-scaffolds `~/.homaruscc/` with all identity files
- Auto-registers as MCP server in Claude Code settings
- Template interpolation (agent name, user name)

HomarUS has a simpler wizard (`setup-wizard.ts`) that covers model provider selection, API keys, default model, and Telegram setup, but:
- No alignment generator integration
- No Claude Code auto-registration
- No identity file scaffolding (soul.md, state.md, preferences.md, disagreements.md)
- No agent naming ceremony

### 2.9 Extended Identity Files

**HomarUScc:** Ships 5 identity templates in `identity.example/`:
- `soul.md` — core identity
- `user.md` — user profile
- `state.md` — mood/emotional continuity (agent-updated)
- `preferences.md` — emergent preferences
- `disagreements.md` — pushback log

**HomarUS:** Creates only `soul.md` and `user.md` during init.

The `IdentityManager` in HomarUScc also has `getAgentState()` and `getDigest()` methods not present in HomarUS.

### 2.10 Memory Enhancements

**HomarUScc** has several memory features beyond HomarUS:

| Feature | HomarUScc | HomarUS |
|---------|-----------|---------|
| Temporal decay | `setDecayConfig()`, configurable half-life, evergreen patterns | Not present |
| Dream-aware scoring | `setDreamConfig()`, dream patterns, dream half-life | Not present |
| MMR (Maximal Marginal Relevance) | Configurable `mmrEnabled`, `mmrLambda` | Not present |
| Recent paths tracking | `getRecentPaths()` | Not present |

### 2.11 Apps Platform

**HomarUScc source:** `src/dashboard-server.ts` — Apps API endpoints

A lightweight app hosting platform:
- List/read/write apps from `~/.homaruscc/apps/`
- Manifest-based app registration
- Per-app data storage (JSON)
- Static file serving per app
- Built-in Kanban app (task CRUD with auto-flush of done tasks)

### 2.12 CRM System

**HomarUScc source:** `src/dashboard-server.ts` — CRM endpoints

A markdown-based contact management system:
- Contacts stored as markdown files with YAML frontmatter in `local/crm/`
- CRUD API: list, get, create, update, delete
- Fields: name, aliases, email, phone, social links, tags, connections, context
- Auto-slug generation
- Sort by last-mentioned date

### 2.13 Document Viewer

**HomarUScc source:** `src/dashboard-server.ts` — `/api/docs` endpoint

Serves markdown files from allowed directories:
- HalShare (Syncthing sync with EC2)
- `~/.homaruscc/` configuration
- CRM contacts
- Directory traversal prevention

### 2.14 Browser Service Improvements

| Feature | HomarUScc `BrowserService` | HomarUS `BrowserManager` |
|---------|---------------------------|--------------------------|
| Persistent browser context | `userDataDir` support via `launchPersistentContext()` | Not present |
| Accessibility snapshot | `snapshot()` via `ariaSnapshot()` | Not present |
| Back/forward navigation | Not present | Present (`back`, `forward` actions) |
| Scroll action | Not present | Present (`scroll` action) |
| Wait action | Not present | Present (`wait` action) |

HomarUScc's browser has persistent sessions (cookies survive restarts) and accessibility tree access. HomarUS has more navigation actions (back, forward, scroll, wait).

### 2.15 Timer Defaults

**HomarUScc config:** `timers.defaults` — array of timer definitions that are auto-registered on startup if they don't already exist.
**HomarUS:** No default timer concept.

### 2.16 Telegram Enhancements

**HomarUScc MCP tools:**
- `telegram_typing` — send typing indicator
- `telegram_react` — react to messages with emoji

These are MCP tool wrappers. The underlying Telegram adapter likely supports these in both, but HomarUS does not expose them as tools in its tool registry.

### 2.17 `run_tool` Meta-Tool

**HomarUScc source:** `src/mcp-tools.ts` — `run_tool`

A meta-tool that lets Claude Code invoke any registered backend tool (bash, read, write, edit, glob, grep, git, web_fetch, web_search, memory_*) through the MCP interface. This bridges the gap between MCP tools and the internal tool registry.

HomarUS agents access tools directly through the `ToolRegistry`, so no meta-tool is needed.

---

## 3. Shared Components (Present in Both)

Both projects share these components with similar implementations:

| Component | HomarUS File | HomarUScc File | Notes |
|-----------|-------------|----------------|-------|
| EventBus | `src/event-bus.ts` | `src/event-bus.ts` | Identical pattern |
| EventQueue | `src/event-queue.ts` | `src/event-queue.ts` | Identical |
| ChannelAdapter | `src/channel-adapter.ts` | `src/channel-adapter.ts` | Identical |
| ChannelManager | `src/channel-manager.ts` | `src/channel-manager.ts` | Similar |
| TelegramAdapter | `src/telegram-adapter.ts` | `src/telegram-adapter.ts` | Similar |
| ToolRegistry | `src/tool-registry.ts` | `src/tool-registry.ts` | Identical pattern |
| SkillManager | `src/skill-manager.ts` | `src/skill-manager.ts` | Identical |
| Skill | `src/skill.ts` | `src/skill.ts` | Identical |
| SkillTransport | `src/skill-transport.ts` | `src/skill-transport.ts` | Identical |
| TimerService | `src/timer-service.ts` | `src/timer-service.ts` | Similar (cc adds defaults) |
| MemoryIndex | `src/memory-index.ts` | `src/memory-index.ts` | cc extends with decay/dreams |
| IdentityManager | `src/identity-manager.ts` | `src/identity-manager.ts` | cc extends with state/digest |
| EmbeddingProvider | `src/embedding-provider.ts` | `src/embedding-provider.ts` | Identical |
| Config | `src/config.ts` | `src/config.ts` | Different defaults |
| Built-in tools | `src/tools/*` (13 files) | `src/tools/*` (12 files) | cc missing LSP |

---

## 4. Dependency Differences

| Dependency | HomarUS | HomarUScc | Notes |
|-----------|---------|-----------|-------|
| `@modelcontextprotocol/sdk` | No | Yes | MCP protocol |
| `ws` | No | Yes | WebSocket for dashboard |
| `playwright` | Optional | Yes (in deps) | Browser automation |
| `express` | Yes | Yes | HTTP server |
| `ajv` | Yes | No | Schema validation |
| `dotenv` | Yes | Yes | Env vars |
| `better-sqlite3` | Yes | Yes | Memory index |
| `sqlite-vec` | Yes | Yes | Vector search |
| `croner` | Yes | Yes | Cron scheduling |
| `uuid` | Yes | Yes | Event IDs |

---

## 5. Prioritized Gap Summary

### Gaps Worth Closing (HomarUS -> HomarUScc)

| Priority | Gap | Effort | Value |
|----------|-----|--------|-------|
| Medium | Unit tests | Medium | Prevents regressions, enables confident refactoring |
| Low | LSP tool | Low (copy+adapt) | Marginal — Claude Code has built-in code analysis |
| Low | Auth on dashboard API | Low | Important if port is ever exposed beyond localhost |
| Low | `install-daemon` CLI | Low | Useful for standalone backend mode |
| Very Low | Config schema validation | Low | Neither project does this currently |
| Very Low | CLI `status`/`config` | Very low | Convenience shortcuts |

### Gaps Worth Closing (HomarUScc -> HomarUS)

| Priority | Gap | Effort | Value |
|----------|-----|--------|-------|
| N/A | Two-process MCP architecture | N/A | Specific to Claude Code integration |
| N/A | Compaction/checkpoint system | N/A | Specific to Claude Code |
| Medium | Web dashboard | High | Would be valuable for HomarUS monitoring |
| Medium | Transcript logger | Medium | Useful for any agent system |
| Medium | Memory decay/dreams | Low | Better memory relevance over time |
| Low | Extended identity files | Low | Richer personality system |
| Low | Apps platform/CRM | Medium | Domain-specific, may not generalize |

---

## 6. Architectural Comparison

```
HomarUS (Standalone Agent Coordinator)
┌─────────────────────────────────────────┐
│  CLI (homarus start/init/status)        │
│  ┌─────────┐  ┌──────────────┐          │
│  │ Config  │  │ HTTP API     │ ← Skills │
│  └────┬────┘  │ (port 18800) │          │
│       │       └──────────────┘          │
│  ┌────▼─────────────────────────┐       │
│  │        Event Loop            │       │
│  │  EventBus ← EventQueue      │       │
│  │       │                      │       │
│  │  ┌────▼─────┐  ┌──────────┐ │       │
│  │  │AgentMgr  │  │ Channels │ │       │
│  │  │(spawns   │  │ Telegram │ │       │
│  │  │ agents)  │  │ CLI      │ │       │
│  │  └────┬─────┘  └──────────┘ │       │
│  │       │                      │       │
│  │  ┌────▼──────────────────┐   │       │
│  │  │  ModelRouter          │   │       │
│  │  │  OpenAI/Anthropic     │   │       │
│  │  │  Fallback + Budget    │   │       │
│  │  └───────────────────────┘   │       │
│  └──────────────────────────────┘       │
│  Memory │ Identity │ Timers │ Skills    │
└─────────────────────────────────────────┘

HomarUScc (Claude Code MCP Body)
┌─────────────────────────────────────────┐
│  Claude Code (the brain)                │
│  ┌──────────────────────┐               │
│  │  MCP Proxy (stdio)   │ ← never dies  │
│  │  - tool forwarding   │               │
│  │  - WS event relay    │               │
│  │  - restart_backend   │               │
│  └──────────┬───────────┘               │
│             │ HTTP                       │
│  ┌──────────▼───────────────────┐       │
│  │  Backend (restartable)       │       │
│  │  ┌─────────────────────┐     │       │
│  │  │    Event Loop       │     │       │
│  │  │  EventBus ← Queue   │     │       │
│  │  │       │              │     │       │
│  │  │  ┌────▼────┐  ┌────┐│     │       │
│  │  │  │Channels │  │ WS ││     │       │
│  │  │  │Telegram │  │ UI ││     │       │
│  │  │  │Dashboard│  └────┘│     │       │
│  │  │  └─────────┘        │     │       │
│  │  └─────────────────────┘     │       │
│  │  Dashboard │ Compaction      │       │
│  │  Checkpoint│ Transcripts     │       │
│  │  AgentReg  │ Apps/CRM        │       │
│  │  Memory    │ Identity        │       │
│  │  Timers    │ Skills          │       │
│  └──────────────────────────────┘       │
└─────────────────────────────────────────┘
```

The fundamental difference: HomarUS thinks for itself (model routing + agent loop). HomarUScc provides a body for Claude Code to inhabit (channels, memory, timers, browser).
