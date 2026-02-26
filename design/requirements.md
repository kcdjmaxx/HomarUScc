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
- **R136:** Backend maintains an in-memory agent registry tracking: id, description, status, startTime
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

## Feature: Agent Completion Callback
**Source:** (replaces agent-completion-polling.md)

- **R154:** Agents signal completion by calling `POST /api/agents/:id/complete` with `{ result }` or `{ error }`
- **R155:** `POST /api/agents/:id/complete` endpoint calls `complete()` or `fail()` on the registry, emitting events
- **R156:** A timeout fallback (default 30 min) marks agents as "timeout" if they never call back
- **R157:** Timeout checker runs every 60s, only while agents are registered, and unrefs to not block shutdown
- **R158:** (removed — file polling replaced by callback)
- **R159:** (removed — replaced by timeout checker)
- **R160:** (inferred) `cleanup(id)` removes agent; stops timeout checker when no agents remain
- **R161:** (removed — no file I/O in completion detection)
- **R162:** (inferred) Agents are only completed once — skip agents already completed/failed/timed-out

## Feature: On Birth (First-Run Wizard)
**Source:** specs/on-birth/on-birth.md

- **R163:** Package.json includes a `bin` entry so `npx homaruscc` invokes the CLI entry point
- **R164:** CLI entry point detects whether `~/.homaruscc/config.json` exists
- **R165:** If config exists, start normally by spawning the MCP proxy
- **R166:** If no config exists, run the On Birth wizard
- **R167:** Wizard prompts for agent name with option to skip (agent self-names on first run)
- **R168:** Wizard prompts for channel selection: Telegram (optional) and Dashboard (always enabled)
- **R169:** Wizard offers two identity paths: Alignment Generator (opens browser URL, user pastes output) or template (copies identity.example files)
- **R170:** Wizard collects user context for user.md: name and freeform "what should the agent know about you"
- **R171:** Wizard collects TELEGRAM_BOT_TOKEN if Telegram channel was selected
- **R172:** After wizard, create `~/.homaruscc/` directory structure including identity/, journal/, memory/, transcripts/
- **R173:** After wizard, write `~/.homaruscc/config.json` from collected answers, deriving from config.example.json
- **R174:** After wizard, write `~/.homaruscc/.env` with collected tokens
- **R175:** After wizard, write identity files (soul.md, user.md, state.md, preferences.md, disagreements.md) to `~/.homaruscc/identity/`
- **R176:** Auto-detect Claude Code settings file location and offer to register HomarUScc as an MCP server
- **R177:** Package.json `files` array includes all necessary files for npm publish (dist/, bin/, identity.example/, config.example.json, .env.example)
- **R178:** Create `.npmignore` to exclude dev files, specs, design, tests, dashboard source
- **R179:** (inferred) Wizard uses a lightweight prompt library or Node.js built-in readline -- minimal dependencies
- **R180:** (inferred) Wizard is a separate module from the MCP server, imported only when needed
- **R181:** (inferred) If user selects Alignment Generator path, open URL in default browser via `open` (macOS) / `xdg-open` (Linux)
- **R182:** (inferred) Config.json written by wizard disables channels not selected (e.g., omits telegram section if not chosen)
- **R183:** (inferred) Wizard prints a summary of created files and next steps on completion
- **R184:** (inferred) Identity template path copies all 5 files from identity.example/ and interpolates agent name and user name where applicable

## Feature: Dashboard Apps Platform
**Source:** specs/apps-platform.md

- **R185:** Apps are React components registered with the dashboard, each with its own route (/apps/{slug})
- **R186:** Apps are discovered from manifest files at `~/.homaruscc/apps/{slug}/manifest.json`
- **R187:** Each app manifest declares: name, description, slug, version, and hook definitions (read, write, describe)
- **R188:** Dashboard sidebar includes an "Apps" section listing all registered apps
- **R189:** Each app can declare hooks (read, write, describe) for agent integration
- **R190:** A single MCP tool `app_invoke` dispatches to app hooks by slug and hook name
- **R191:** `read` hook returns the app's current data.json contents as JSON
- **R192:** `write` hook accepts a JSON payload and writes to the app's data.json
- **R193:** `describe` hook returns a natural language summary of the app's state (agent-generated from data)
- **R194:** Each app stores data in `~/.homaruscc/apps/{slug}/data.json`
- **R195:** App data persists across dashboard restarts
- **R196:** Agent accesses app data only through hooks, not by direct file reads
- **R197:** On backend startup, scan `~/.homaruscc/apps/*/manifest.json` to build the app registry
- **R198:** REST endpoint `GET /api/apps` returns the list of registered apps with metadata
- **R199:** REST endpoint `GET /api/apps/:slug/component` serves the compiled app component JS
- **R200:** Frontend dynamically imports app components at runtime from the backend
- **R201:** Backend watches `~/.homaruscc/apps/` for new/changed manifests and updates registry
- **R202:** Apps are served through the same Express server (port 3120), accessible over Tailscale
- **R203:** Apps should be mobile-responsive using inline styles consistent with the dashboard
- **R204:** App directory defaults to `~/.homaruscc/apps/`, configurable via `dashboard.apps.directory`
- **R205:** (inferred) Create apps directory on first access if it does not exist
- **R206:** (inferred) Invalid manifests are logged and skipped, not fatal
- **R207:** (inferred) `GET /api/apps` also serves as the app list for the MCP tool to enumerate available apps
- **R208:** (inferred) App creation by the agent uses existing filesystem MCP tools to write manifest.json and component source
- **R209:** (inferred) The `app_invoke` tool returns errors gracefully if the app or hook does not exist
- **R210:** (inferred) Frontend shows an empty state in the Apps view when no apps are installed

## Feature: Telegram Slash Commands & Crash Recovery
**Source:** specs/telegram-commands.md

- **R211:** TelegramChannelAdapter intercepts messages starting with `/` and routes to a TelegramCommandHandler before event delivery
- **R212:** Registered commands are handled entirely by the backend — no Claude involvement
- **R213:** Unknown `/` commands pass through as normal message events
- **R214:** `/ping` command returns "pong" immediately — minimal liveness check
- **R215:** `/status` command returns system health: channels, timers, memory stats, Claude liveness
- **R216:** Claude liveness is determined by last `/api/wait` poll timestamp — if >120s ago, Claude is disconnected
- **R217:** `/restart` command kills existing Claude Code process and starts a new session
- **R218:** `/restart` sends an immediate acknowledgment before spawning the restart script
- **R219:** `bin/restart-claude` script handles process kill and session startup as a detached child process
- **R220:** Restart script calls back to backend with success/failure, backend forwards result via Telegram
- **R221:** `POST /api/restart-result` endpoint receives restart script callback and sends result to originating chat
- **R222:** DashboardServer tracks last `/api/wait` call timestamp for Claude liveness detection
- **R223:** (inferred) Command handler is registered during backend startup with access to subsystem context
- **R224:** (inferred) Only messages from allowed chat IDs can trigger commands (existing security filter applies first)
- **R225:** (inferred) Commands execute quickly — `/restart` spawns detached and returns immediately

## Feature: Spaces
**Source:** specs/spaces.md

- **R301:** Buckets are directories containing `_bucket.md` with YAML frontmatter (id, name, description, statuses, color, sortOrder, property definitions)
- **R302:** Items are markdown files with YAML frontmatter (id, status, priority 0-3, tags, due date, assignee, createdBy, created, updated, custom properties)
- **R303:** Buckets can nest as sub-directories with no depth limit in data; UI caps display at 3 levels
- **R304:** Spaces root directory contains `_root.md` for global config and top-level bucket sort order
- **R305:** Storage path configurable via `config.json` under `spaces.path`; default derived from vault root + `/Spaces/`
- **R306:** Default buckets pre-seeded on first run: Fric & Frac (Marketing, Staffing, Menu, Operations), Miami Ice, Personal, Projects (HomarUScc, TED Talk)
- **R307:** SpacesManager loads full directory tree into in-memory cache on startup
- **R308:** SpacesManager watches directory for external changes (Obsidian edits) and invalidates cache on file modification
- **R309:** Writes use write-to-temp-then-rename pattern for atomicity, then update cache
- **R310:** `GET /api/spaces/tree` returns full nested tree of buckets + items
- **R311:** `POST /api/spaces/buckets` creates a bucket with name, optional parentId, description, statuses, color, properties
- **R312:** `PATCH /api/spaces/buckets/:id` updates bucket metadata
- **R313:** `DELETE /api/spaces/buckets/:id` deletes bucket and all contents (items + sub-buckets)
- **R314:** `POST /api/spaces/buckets/:id/items` creates an item in a bucket with title, optional body/tags/priority/status/due/assignee/properties
- **R315:** `PATCH /api/spaces/items/:id` updates any item field (frontmatter or body)
- **R316:** `DELETE /api/spaces/items/:id` deletes an item
- **R317:** `POST /api/spaces/items/:id/move` moves an item to a different bucket
- **R318:** `GET /api/spaces/search?q=...` searches items across all buckets by title, body, tags, property values
- **R319:** SpacesView.tsx is a single-file React component receiving `messages` and `send` props for chat integration
- **R320:** List view displays buckets as collapsible tree with indented sub-buckets; items show title, status chip, priority, due date, assignee
- **R321:** Status chips are clickable and cycle through the bucket's defined statuses
- **R322:** Due dates highlighted red if overdue, amber if within 2 days
- **R323:** Quick-add: type title + Enter to add item; optional expansion for additional fields
- **R324:** Global search bar at top filters items across all buckets
- **R325:** Click item title to edit inline; click body to expand/edit
- **R326:** Item deletion is immediate; bucket deletion requires confirmation (click twice)
- **R327:** Markdown checkboxes in item body rendered as interactive checkboxes; toggling updates the file on disk
- **R328:** Chat panel scoped to current bucket context, reusing CrmChat pattern
- **R329:** Sidebar entry: View type "spaces", icon "%", label "Spaces"
- **R330:** Custom properties defined per bucket (key, type, label); types: text, url, number, date, select
- **R331:** Items in a bucket can set values for that bucket's defined properties
- **R332:** Assignee field: "max" or "caul", displayed as initial chip
- **R333:** MCP tool `spaces_list_buckets` lists all buckets with item counts
- **R334:** MCP tool `spaces_get_bucket` returns bucket details + all items
- **R335:** MCP tool `spaces_create_bucket` creates a new bucket, optionally nested under a parent
- **R336:** MCP tool `spaces_add_item` adds an item to a bucket
- **R337:** MCP tool `spaces_update_item` updates an existing item
- **R338:** MCP tool `spaces_search` searches items across all buckets
- **R339:** (inferred) Filenames slugified from titles; collisions handled by appending -2, -3, etc.
- **R340:** (inferred) Create spaces directory and default buckets on first access if they do not exist
- **R341:** (inferred) Inline styles only, dark theme palette matching existing dashboard
- **R342:** (inferred) No external dependencies; React 19 only
- **R343:** (inferred) Item IDs are generated as `item-{timestamp}-{random}`; bucket IDs as `bucket-{slug}`

## Feature: Dashboard Theming
**Source:** specs/dashboard-theming.md

- **R350:** Define dark and light color palettes with semantic names: bg, surface, border, text, textMuted, accent, success, warning, error, buttonBg, buttonText
- **R351:** Create a ThemeProvider React context that wraps the entire app and provides current palette + toggle function
- **R352:** Create a useTheme() hook that returns the current theme palette and a toggleTheme() function
- **R353:** Store theme preference ("dark" or "light") in localStorage under key "homaruscc-theme"; restore on page load
- **R354:** Default to dark theme when no localStorage value exists (preserves current behavior for existing users)
- **R355:** Add a theme toggle button in the sidebar footer area, visible on both mobile and desktop
- **R356:** Update App.tsx to use theme colors for container background, text color, hamburger, and backdrop
- **R357:** Update Sidebar.tsx to use theme colors for nav background, brand, menu items, status indicators, and close button
- **R358:** Update Chat.tsx to use theme colors for header, messages, bubbles, input area, and send button
- **R359:** Update EventLog.tsx to use theme colors for header, event rows, badges, payload, and count chip
- **R360:** Update StatusPanel.tsx to use theme colors for cards, section titles, rows, dots, and labels
- **R361:** Update MemoryBrowser.tsx to use theme colors for search bar, input, results, path, score chip, and content
- **R362:** Update KanbanView.tsx to use theme colors for columns, cards, forms, buttons, and assignee selectors
- **R363:** Update CrmView.tsx to use theme colors for contact list, detail view, forms, chat panel, and doc viewer
- **R364:** Update AppsView.tsx to use theme colors for app grid, cards, iframe background, and data section
- **R365:** Update SpacesView.tsx to use theme colors for bucket tree, items, forms, chat panel, and status/priority chips
- **R366:** No CSS files or CSS modules -- all theming via inline styles using the theme object from useTheme()
- **R367:** No external dependencies -- React 19 context and hooks only
- **R368:** (inferred) Theme toggle uses a sun/moon text indicator to communicate which theme will be applied
- **R369:** (inferred) ThemeProvider also sets CSS custom properties on document.documentElement for edge cases (scrollbar, selection colors)

## Feature: Dashboard Skills Registry
**Source:** specs/dashboard-view-registry.md

- **R401:** Create a SkillsRegistry module (`dashboard/src/skills-registry.ts`) that exports `registerSkill()`, `getSidebarSkills()`, `getAppsSkills()`, `getHeadlessSkills()`
- **R402:** SkillRegistration interface declares: id (string slug), name (display label), icon (single char), surface ("sidebar" | "apps" | "headless"), order (number), core (boolean), plus surface-specific optional fields
- **R403:** ViewProps interface provides messages (WsMessage[]) and send ((msg: object) => void) to sidebar skills uniformly
- **R404:** Each sidebar skill calls `registerSkill()` at module scope as a side effect of import
- **R405:** Core skills (Chat, Events, Status) set `core: true` and are always enabled regardless of config
- **R406:** Non-core skills can be disabled via config (sidebar, apps, and headless)
- **R407:** Config.json `dashboard.skills` object maps skill id to boolean; absent keys default to enabled
- **R408:** Backend exposes `GET /api/config/skills` returning the `dashboard.skills` config map
- **R409:** Frontend fetches skill config on startup and filters registered skills accordingly (core skills skip filtering)
- **R410:** App.tsx replaces the hardcoded `View` union type with a string skill id resolved from the registry
- **R411:** App.tsx renders the active sidebar skill by looking up its component in the registry, passing ViewProps
- **R412:** Sidebar.tsx receives the filtered, sorted sidebar skill list from the parent instead of owning a hardcoded items array
- **R413:** Sidebar items are sorted by the `order` field from SkillRegistration
- **R414:** Core sidebar skills use orders 10-30; non-core sidebar skills use orders 40-80; headless skills use order 0
- **R415:** Adding a new sidebar skill requires only creating the component file with a `registerSkill()` call and importing it in App.tsx
- **R416:** The existing AppsView renders `surface: "apps"` skills from the registry as cards/tiles with links
- **R417:** Default view on startup is the first core sidebar skill by order (Chat, order 10)
- **R418:** If the active view is disabled by config change, fall back to the default view
- **R419:** Registry is a simple module-level array — no React context, no runtime mutation after initial import
- **R420:** Sidebar skills that do not use messages or send simply ignore those props
- **R421:** `surface: "sidebar"` requires `component` field (React.ComponentType<ViewProps>)
- **R422:** `surface: "apps"` requires `url` field and optional `description` field
- **R423:** `surface: "headless"` has optional `tools` (string[]) and `timers` (string[]) metadata fields
- **R424:** Status page can display headless skills with their tools and timer info for visibility
- **R425:** Three surface types unify the previously separate built-in views and external apps into one registry
