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

## Feature: Temporal Decay on Memory Search
**Source:** specs/temporal-decay.md

- **R82:** Apply exponential decay multiplier to search scores based on chunk age: `0.5 ^ (ageDays / halfLifeDays)`
- **R83:** Default half-life is 30 days (configurable via `memory.decay.halfLifeDays`)
- **R84:** Evergreen content (matching configurable path patterns) gets decay multiplier of 1.0 regardless of age
- **R85:** Default evergreen patterns: `MEMORY.md`, `SOUL.md`, `USER.md`
- **R86:** Decay is configurable: `memory.decay.enabled` (default true), `memory.decay.halfLifeDays` (default 30), `memory.decay.evergreenPatterns` (default list)
- **R87:** Decay multiplier is applied after hybrid score computation but before minScore filter and final sort
- **R88:** Chunks with no `updated_at` timestamp are treated as evergreen (no decay)
- **R89:** (inferred) Decay is a search-time-only change — no schema or indexing modifications

## Feature: MMR Diversity Re-ranking
**Source:** specs/mmr-reranking.md

- **R90:** After computing hybrid scores with decay, re-rank results using MMR to balance relevance with diversity
- **R91:** MMR score: `lambda * relevance(d) - (1 - lambda) * max_similarity(d, selected)` where relevance is the existing hybrid score
- **R92:** Default lambda is 0.7 (configurable via `memory.search.mmrLambda`)
- **R93:** MMR is enabled by default (configurable via `memory.search.mmrEnabled`)
- **R94:** When embedding provider is available, use cosine similarity between chunk embeddings for diversity penalty
- **R95:** When no embedding provider, fall back to Jaccard similarity on word sets
- **R96:** MMR re-ranking happens after decay and minScore filter, before final slice to limit
- **R97:** (inferred) Single results skip MMR (no re-ranking needed)

## Feature: Session Transcript Indexing
**Source:** specs/session-transcripts.md

- **R98:** Capture inbound message events (Telegram, dashboard) as transcript turns with timestamp, channel, direction, and sender
- **R99:** Capture outbound responses (telegram_send, dashboard_send tool calls) as transcript turns
- **R100:** Accumulate turns in a session buffer and periodically flush to dated markdown files
- **R101:** Store transcripts under configurable directory (default `~/.homaruscc/transcripts/`)
- **R102:** Flush buffer every N minutes (configurable, default 5 minutes) if non-empty
- **R103:** Flush buffer on shutdown
- **R104:** Index transcript files via MemoryIndex.indexFile after flush so they become searchable
- **R105:** Transcript indexing is configurable: `memory.transcripts.enabled` (default true), `memory.transcripts.directory`, `memory.transcripts.flushIntervalMs`
- **R106:** (inferred) Create transcript directory on first flush if it doesn't exist
- **R107:** (inferred) Flush failures log error and retain buffer for retry
- **R108:** (inferred) Trigger transcript flush during pre-compaction routine

## Feature: Dream System
**Source:** specs/dreams.md

- **R109:** Schedule a nightly dream cycle at 3am CST via cron timer (`0 3 * * *`, timezone `America/Chicago`)
- **R110:** Dream cycle executes three phases in sequence: memory consolidation, associative dreaming, overfitting prevention
- **R111:** Memory consolidation phase pulls recent memories (24-48h) and evaluates their importance, reinforcing significant ones
- **R112:** Associative dreaming phase pulls 3-5 random memories from different time periods/topics and force-connects them
- **R113:** Overfitting prevention phase pulls a random established preference or pattern and challenges its validity
- **R114:** Dream output is stored under `dreams/` key prefix in the unified memory index (e.g., `dreams/2026-02-21.md`)
- **R115:** Dream-origin memories receive a configurable base weight multiplier (default 0.5x) applied during search scoring
- **R116:** Dream-origin memories decay with a configurable half-life (default 7 days) separate from the global decay half-life
- **R117:** Dream path patterns are configurable via `memory.dreams.patterns` (default `["dreams/"]`)
- **R118:** Dream output uses high-fuzziness style: stream-of-consciousness, impressionistic, no definitive claims
- **R119:** After the dream cycle completes, send a dream digest summary via Telegram to the configured chat
- **R120:** During waking interactions, when a search result path matches a dream pattern, the agent should explicitly note the dream origin
- **R121:** (inferred) Dream cycle token budget targets ~2000 tokens (3-4 prompts across phases)
- **R122:** (inferred) Each night's dream is independent — no continuity from previous nights
- **R123:** (inferred) Dream config section: `memory.dreams.halfLifeDays`, `memory.dreams.baseWeight`, `memory.dreams.patterns`

## Feature: Session Checkpoint
**Source:** specs/session-checkpoint.md

- **R124:** Backend maintains a session checkpoint file at `~/.homaruscc/checkpoint.json`
- **R125:** Checkpoint contains: currentTopic, recentDecisions (max 10), inProgressTask, recentMessages (last 5 summarized), modifiedFiles, timestamp
- **R126:** `POST /api/checkpoint` endpoint accepts partial checkpoint updates (merge semantics)
- **R127:** `GET /api/checkpoint` endpoint returns current checkpoint or empty object if none exists
- **R128:** Pre-compact hook triggers a checkpoint save before compaction
- **R129:** Post-compact hook includes checkpoint contents in its context re-injection text
- **R130:** Checkpoint is cleared (deleted) on clean session end to prevent stale state on next startup
- **R131:** (inferred) Skill prompt instructs Claude to update checkpoint after handling each significant event
- **R132:** (inferred) Checkpoint updates are lightweight — only changed fields, merge with existing

## Feature: Agent Dispatcher
**Source:** specs/agent-dispatcher.md

- **R133:** Main event loop dispatches heavy tasks to background Claude Code Task agents with isolated context windows
- **R134:** Dispatch decision is made by Claude in the skill prompt: inline for quick responses, dispatch for heavy work
- **R135:** Background agents are spawned via Task tool with `run_in_background: true`
- **R136:** Backend maintains an in-memory agent registry tracking: id, description, status, startTime, outputFile
- **R137:** `POST /api/agents` registers a new agent in the registry
- **R138:** `GET /api/agents` returns all tracked agents with current status
- **R139:** `PATCH /api/agents/:id` updates agent status (completed/failed) with result summary
- **R140:** When an agent is marked completed, backend emits an `agent_completed` event into the event system
- **R141:** Config section `agents.maxConcurrent` (default 3) limits concurrent background agents
- **R142:** When max concurrency is reached, the skill prompt defers dispatch until a slot opens
- **R143:** Spawned agents receive task context and relevant pre-fetched memory but NOT identity/soul files
- **R144:** Spawned agents do NOT have direct access to Telegram/dashboard — results route through the main loop
- **R145:** Main loop notifies Max via Telegram/dashboard when an agent completes with a result summary
- **R146:** (inferred) Config section: `agents.maxConcurrent`, `agents.defaultModel`, `agents.defaultType`
- **R147:** (inferred) Agent registry entries are cleaned up after results are delivered (no unbounded growth)
- **R148:** (inferred) Skill prompt provides heuristics for inline vs dispatch decisions

## Feature: Identity Digest
**Source:** specs/identity-digest.md

- **R149:** IdentityManager provides a `getDigest()` method that returns a compressed identity (~200 tokens) extracting name, Vibe section, and last session mood
- **R150:** CompactionManager tracks a `compactedSinceLastWake` flag, set on post-compact and consumed on read
- **R151:** `/api/wait` returns compressed digest (`identity.full: false`) on normal event wakes
- **R152:** `/api/wait` returns full identity payload (soul, user, state, `identity.full: true`) on the first wake after context compaction
- **R153:** Skill prompt documents both identity response formats (digest vs full) with JSON examples and branching logic

## Feature: Agent Completion Polling
**Source:** specs/agent-completion-polling.md

- **R154:** AgentRegistry polls output files of registered agents to detect completion
- **R155:** Poll interval is configurable via constructor parameter (default 5000ms)
- **R156:** Detection checks file tail (last 512 bytes) for completion markers (`"stop_reason":"end_turn"` or `"type":"result"`) or stable mtime (no modification in 10 seconds)
- **R157:** On detection, call existing `complete()` method which emits `agent_completed` event
- **R158:** Only poll agents with status "running" that have an outputFile set
- **R159:** `startPolling()` begins a single global setInterval; `stopPolling()` clears it so it does not keep the process alive
- **R160:** (inferred) `cleanup(id)` clears any per-agent polling state
- **R161:** (inferred) File read errors (ENOENT, permission) are logged and skipped, not thrown
- **R162:** (inferred) Agents are only completed once — skip agents already completed/failed
