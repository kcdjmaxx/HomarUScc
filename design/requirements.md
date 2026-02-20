# Requirements

## Feature: Event Loop
**Source:** specs/event-loop.md

- **R1:** Initialize all subsystems in order: config, identity, memory, browser, tools, skills, timers, channels
- **R2:** Accept events from channels, timers, and skills into a priority queue
- **R3:** Process events every 50ms via EventBus routing to registered handlers
- **R4:** Forward unhandled events to Claude Code via MCP notification callback
- **R5:** Maintain a rolling history of the last 100 events
- **R6:** Support long-poll waiters that block until events arrive or timeout
- **R7:** On shutdown, drain queue, resolve waiters, and stop all subsystems
- **R8:** Events have id (UUID), type, source, timestamp, payload, optional replyTo and priority
- **R9:** Priority queue drops lowest priority on overflow (configurable strategy)

## Feature: MCP Server
**Source:** specs/mcp-server.md

- **R10:** Expose tools and resources to Claude Code over MCP stdio transport
- **R11:** Register 18 MCP tools: telegram (2), memory (2), timers (2), dashboard (1), system (3), browser (7), run_tool (1)
- **R12:** Expose 4 MCP resources: identity://soul, identity://user, config://current, events://recent
- **R13:** Redact secrets (tokens) in config://current resource
- **R14:** Route event loop notifications to MCP server notifications

## Feature: Channels
**Source:** specs/channels.md

- **R15:** ChannelManager loads adapters from config, manages connect/disconnect lifecycle
- **R16:** Base adapter provides state machine: disconnected → connecting → connected | error
- **R17:** Enforce access control via DM policy (pairing, allowlist, open, disabled) and group policy (mention_required, always_on, disabled)
- **R18:** Normalize inbound messages to standard Event format
- **R19:** Telegram adapter polls via getUpdates with exponential backoff (1s to 30s max)
- **R20:** Telegram adapter detects @mentions for group policy
- **R21:** Telegram adapter buffers last 50 messages for telegram_read tool
- **R22:** Telegram adapter supports allowedChatIds whitelist
- **R23:** Dashboard adapter bridges WebSocket chat to event loop bidirectionally

## Feature: Dashboard
**Source:** specs/dashboard.md

- **R24:** Serve React SPA as static files from Express
- **R25:** HTTP API endpoints for status, events, timers, memory stats, identity
- **R26:** Long-poll endpoint (/api/wait) blocks until events or timeout (204 on timeout, 200 with events)
- **R27:** WebSocket server for real-time bidirectional communication
- **R28:** Handle chat, memory search, status, and event streaming over WebSocket
- **R29:** Auto-recover from port conflicts (kill stale process on EADDRINUSE)
- **R30:** Frontend components: Sidebar, Chat, EventLog, StatusPanel, MemoryBrowser
- **R31:** useWebSocket hook with auto-reconnect and message buffering (500 messages)
- **R32:** Dashboard configurable port (default 3120) and can be disabled

## Feature: Memory
**Source:** specs/memory.md

- **R33:** Store content in SQLite with chunks, FTS5, and vector tables
- **R34:** Split files into word-based chunks (400 words, 80 word overlap)
- **R35:** Hybrid search scoring: vector similarity (0.7 weight) + FTS BM25 (0.3 weight)
- **R36:** Pluggable embedding provider via OpenAI-compatible API
- **R37:** Batch embedding support for efficient indexing
- **R38:** Auto-sync FTS and vector tables via database triggers
- **R39:** Optional file watcher for automatic re-indexing on .md changes
- **R40:** memory_store writes content to file and indexes in one operation
- **R41:** Configurable minimum score threshold (default 0.3)

## Feature: Timers
**Source:** specs/timers.md

- **R42:** Support cron (5-field with optional timezone), interval (ms), and once (ISO 8601) timer types
- **R43:** Deduplicate timers by name — adding replaces existing timer with same name
- **R44:** Emit "timer_fired" event with {timerId, name, prompt} payload
- **R45:** Persist timers to JSON file and restore on restart
- **R46:** Auto-delete one-shot timers after firing
- **R47:** Clean up expired one-shot timers on load

## Feature: Browser
**Source:** specs/browser.md

- **R48:** Lazy browser initialization — only launch on first tool call
- **R49:** Support ephemeral (clean) and persistent (userDataDir) browser sessions
- **R50:** Provide navigate, snapshot, screenshot, click, type, evaluate, getContent operations
- **R51:** Configurable viewport, proxy, executable path, timeout (default 30s)
- **R52:** Disabled by default, enabled via config

## Feature: Identity
**Source:** specs/identity.md

- **R53:** Load soul.md and user.md from configured identity directory
- **R54:** Support per-channel and per-task overlays from overlays/ subdirectory
- **R55:** Include workspace directory .md files in system prompt with ## filename headers
- **R56:** Assemble system prompt by joining parts with --- separators in defined order
- **R57:** Expose soul and user content as MCP resources

## Feature: Skills
**Source:** specs/skills.md

- **R58:** Load skills from directories containing skill.json manifest
- **R59:** Support HTTP, stdio, and direct transport modes
- **R60:** Skills declare handled event types and emitted event types in manifest
- **R61:** Skills can register tools in the ToolRegistry
- **R62:** Hot-reload skills when skill.json changes on disk
- **R63:** Skill state machine: loaded → starting → running → stopping → stopped | error

## Feature: Tools
**Source:** specs/tools.md

- **R64:** Registry for all executable tools with named groups (fs, runtime, web, memory, browser)
- **R65:** Bash tool blocks dangerous patterns (rm -rf, sudo, mkfs, dd, chmod 777, curl|bash, fork bombs)
- **R66:** Config-driven tool policies with allow/deny lists supporting group references
- **R67:** run_tool MCP tool dispatches to any registered tool by name
- **R68:** Tool output truncated to 50k characters

## Feature: Config
**Source:** specs/config.md

- **R69:** Resolve config path: HOMARUSCC_CONFIG env → cwd/homaruscc.json → ~/.homaruscc/config.json
- **R70:** Substitute ${VAR_NAME} patterns with environment variables recursively
- **R71:** Load .env file from config directory via dotenv
- **R72:** Hot-reload config file every 2 seconds with safe/unsafe change classification
- **R73:** Safe changes (memory.search, skills.paths, timers.enabled, dashboard.enabled) apply without restart
- **R74:** Parse errors during reload retain old config

## Feature: Auto-Flush Before Compaction
**Source:** specs/auto-flush.md

- **R75:** Expose /api/pre-compact endpoint that returns a flush prompt summarizing what should be persisted before compaction
- **R76:** Expose /api/post-compact endpoint that returns critical context for re-injection after compaction
- **R77:** Track flush state per compaction cycle — prevent duplicate flushes, reset on post-compact
- **R78:** Log pre-compact and post-compact events to event history
- **R79:** Post-compact response includes: active timer names, current task context, identity file paths, recent memory keys
- **R80:** Pre-compact response includes: a prompt instructing the agent to save recent conversation topics, decisions, task progress, and unsaved observations to memory
- **R81:** (inferred) Provide hook configuration in setup/installation instructions for users to add to their Claude Code settings
