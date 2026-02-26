# Design: HomarUScc

## Intent

HomarUScc is an MCP server that gives Claude Code a persistent presence — messaging channels, memory, timers, browser automation, and extensible tools. Claude Code is the brain; HomarUScc is the nervous system. The design prioritizes event-driven architecture with clean separation between I/O adapters and the reasoning layer (Claude Code).

## Cross-cutting Concerns

### Error Handling
Tool execution catches errors and returns them as `{error: string}` rather than throwing. Channel adapters use exponential backoff on connection failures. Config reload errors retain the previous valid config. Skills that fail to load are logged and skipped.

### Logging
All components accept a Logger interface (debug/info/warn/error with optional metadata). The MCP server creates a stderr-based logger. No stdout logging (would corrupt MCP stdio transport).

### Security
- Bash tool blocks dangerous patterns (rm -rf, sudo, fork bombs, etc.)
- Config secrets use ${ENV_VAR} indirection — never stored in plain text
- Tool policies provide allow/deny enforcement
- Channel access control via DM and group policies
- Config resource redacts tokens before exposure

### Theming
All dashboard components use `useTheme()` hook to access the current color palette. Colors are referenced as `theme.bg`, `theme.surface`, `theme.text`, etc. The ThemeProvider wraps the app root and manages localStorage persistence. See crc-ThemeProvider.md.

## Artifacts

### CRC Cards
- [x] crc-McpServer.md → `src/mcp-server.ts`, `src/mcp-tools.ts`, `src/mcp-resources.ts`
- [x] crc-McpProxy.md → `src/mcp-proxy.ts`
- [x] crc-Backend.md → `src/backend.ts`
- [x] crc-HomarUScc.md → `src/homaruscc.ts`
- [x] crc-EventBus.md → `src/event-bus.ts`
- [x] crc-EventQueue.md → `src/event-queue.ts`
- [x] crc-Config.md → `src/config.ts`
- [x] crc-ChannelManager.md → `src/channel-manager.ts`
- [x] crc-ChannelAdapter.md → `src/channel-adapter.ts`
- [x] crc-TelegramChannelAdapter.md → `src/telegram-adapter.ts`
- [x] crc-DashboardAdapter.md → `src/dashboard-adapter.ts`
- [x] crc-DashboardServer.md → `src/dashboard-server.ts`
- [x] crc-MemoryIndex.md → `src/memory-index.ts`
- [x] crc-EmbeddingProvider.md → `src/embedding-provider.ts`
- [x] crc-IdentityManager.md → `src/identity-manager.ts`
- [x] crc-TimerService.md → `src/timer-service.ts`
- [x] crc-BrowserService.md → `src/browser-service.ts`
- [x] crc-ToolRegistry.md → `src/tool-registry.ts`
- [x] crc-SkillManager.md → `src/skill-manager.ts`
- [x] crc-Skill.md → `src/skill.ts`
- [x] crc-SkillTransport.md → `src/skill-transport.ts`
- [x] crc-DashboardFrontend.md → `dashboard/src/App.tsx`, `dashboard/src/hooks/useWebSocket.ts`, `dashboard/src/components/Chat.tsx`, `dashboard/src/components/EventLog.tsx`, `dashboard/src/components/StatusPanel.tsx`, `dashboard/src/components/MemoryBrowser.tsx`, `dashboard/src/components/Sidebar.tsx`
- [x] crc-CompactionManager.md → `src/compaction-manager.ts`
- [x] crc-TranscriptLogger.md → `src/transcript-logger.ts`

- [x] crc-DreamScoring.md → `src/memory-index.ts`
- [x] crc-DreamCyclePrompt.md → `.claude/skills/homaruscc`

- [x] crc-SessionCheckpoint.md → `src/session-checkpoint.ts`
- [x] crc-AgentRegistry.md → `src/agent-registry.ts`
- [x] crc-AgentDispatchPrompt.md → `.claude/skills/homaruscc`

### Telegram Slash Commands & Crash Recovery
- [x] crc-TelegramCommandHandler.md → `src/telegram-command-handler.ts`

### Dashboard Apps Platform
- [x] crc-AppRegistry.md → `src/app-registry.ts`
- [x] crc-AppDataStore.md → `src/app-data-store.ts`
- [x] crc-AppsFrontend.md → `dashboard/src/components/AppsView.tsx`

### Sequences
- [x] seq-startup.md → `src/homaruscc.ts`, `src/mcp-server.ts`
- [x] seq-event-flow.md → `src/homaruscc.ts`, `src/event-bus.ts`, `src/event-queue.ts`, `src/channel-manager.ts`, `src/mcp-server.ts`
- [x] seq-shutdown.md → `src/homaruscc.ts`
- [x] seq-memory-search.md → `src/memory-index.ts`, `src/embedding-provider.ts`, `src/mcp-tools.ts`
- [x] seq-timer-fire.md → `src/timer-service.ts`, `src/homaruscc.ts`, `src/mcp-server.ts`
- [x] seq-browser-action.md → `src/browser-service.ts`, `src/mcp-tools.ts`
- [x] seq-compaction-flush.md → `src/compaction-manager.ts`, `src/dashboard-server.ts`
- [x] seq-transcript-capture.md → `src/transcript-logger.ts`, `src/homaruscc.ts`, `src/mcp-tools.ts`

- [x] seq-dream-cycle.md → `src/memory-index.ts`

- [x] seq-compaction-checkpoint.md → `src/session-checkpoint.ts`, `src/compaction-manager.ts`, `src/dashboard-server.ts`
- [x] seq-agent-dispatch.md → `src/agent-registry.ts`, `src/dashboard-server.ts`
- [x] seq-agent-poll.md → `src/agent-registry.ts`

- [x] seq-telegram-command.md → `src/telegram-command-handler.ts`, `src/telegram-adapter.ts`, `src/dashboard-server.ts`

- [x] seq-apps-startup.md → `src/app-registry.ts`, `src/dashboard-server.ts`
- [x] seq-apps-invoke.md → `src/app-data-store.ts`, `src/mcp-tools.ts`
- [x] seq-apps-load.md → `dashboard/src/components/AppsView.tsx`, `dashboard/src/App.tsx`

### On Birth (First-Run Wizard)
- [x] crc-Cli.md → `src/cli.ts`
- [x] crc-Wizard.md → `src/wizard.ts`
- [x] crc-Scaffolder.md → `src/scaffolder.ts`
- [x] crc-ClaudeCodeRegistrar.md → `src/claude-code-registrar.ts`
- [x] crc-NpmPackage.md → `package.json`, `.npmignore`
- [x] seq-first-run.md → `src/cli.ts`, `src/wizard.ts`, `src/scaffolder.ts`, `src/claude-code-registrar.ts`
- [x] seq-normal-start.md → `src/cli.ts`
- [x] test-Scaffolder.md → `src/__tests__/scaffolder.test.ts`
- [x] test-ClaudeCodeRegistrar.md → `src/__tests__/claude-code-registrar.test.ts`

### Spaces
- [x] crc-SpacesManager.md → `src/spaces-manager.ts`
- [x] crc-SpacesView.md → `dashboard/src/components/SpacesView.tsx`
- [x] seq-spaces-crud.md → `src/spaces-manager.ts`, `src/dashboard-server.ts`, `dashboard/src/components/SpacesView.tsx`
- [x] seq-spaces-sync.md → `src/spaces-manager.ts`

### Dashboard Skills Registry
- [x] crc-ViewRegistry.md (SkillsRegistry) → `dashboard/src/skills-registry.ts`, `dashboard/src/App.tsx`, `dashboard/src/components/Sidebar.tsx`
- [x] seq-view-registration.md → `dashboard/src/skills-registry.ts`, `dashboard/src/App.tsx`, `dashboard/src/components/Sidebar.tsx`, `dashboard/src/components/AppsView.tsx`, `src/dashboard-server.ts`

### Dashboard Theming
- [x] crc-ThemeProvider.md → `dashboard/src/theme.tsx`, `dashboard/src/App.tsx`, `dashboard/src/components/Sidebar.tsx`, `dashboard/src/components/Chat.tsx`, `dashboard/src/components/EventLog.tsx`, `dashboard/src/components/StatusPanel.tsx`, `dashboard/src/components/MemoryBrowser.tsx`, `dashboard/src/components/KanbanView.tsx`, `dashboard/src/components/CrmView.tsx`, `dashboard/src/components/AppsView.tsx`, `dashboard/src/components/SpacesView.tsx`
- [x] seq-theme-toggle.md → `dashboard/src/theme.tsx`, `dashboard/src/components/Sidebar.tsx`

### Test Designs
- [x] test-EventQueue.md → `src/event-queue.ts`
- [x] test-Config.md → `src/config.ts`
- [x] test-TimerService.md → `src/timer-service.ts`
- [x] test-ToolRegistry.md → `src/tool-registry.ts`
- [x] test-TemporalDecay.md → `src/memory-index.ts`
- [x] test-MMR.md → `src/memory-index.ts`
- [x] test-TranscriptLogger.md → `src/transcript-logger.ts`

- [x] test-DreamScoring.md → `src/memory-index.ts`

- [x] test-SessionCheckpoint.md → `src/session-checkpoint.ts`
- [x] test-AgentRegistry.md → `src/agent-registry.ts`

- [x] test-AppRegistry.md → `src/__tests__/app-registry.test.ts`
- [x] test-AppDataStore.md → `src/__tests__/app-data-store.test.ts`

## Gaps

- [x] O1: No unit tests implemented yet (test designs exist but no test files in src/)
- [x] O2: No automated CI/CD pipeline
- [x] O3: Dashboard frontend has no tests
- [x] O4: types.ts has no CRC card (shared types file, not a class — acceptable)
- [x] O5: bin/event-loop has no traceability comment (bash script, not TypeScript — acceptable)
- [x] O6: dashboard/src/main.tsx has no traceability comment (React entry point, trivial — acceptable)

- [x] O7: Hook configuration instructions added to README (PreCompact and SessionStart hooks with JSON examples)
- [ ] O8: No test design for Wizard (interactive prompts are hard to unit test -- consider extracting prompt logic from I/O)
- [ ] O9: No test design for Cli (entry point logic is minimal -- config existence check + delegation)
- [ ] O10: Wizard does not handle SIGINT gracefully mid-prompt (user Ctrl+C during wizard)
- [ ] O11: No Windows support for openBrowser (only macOS `open` and Linux `xdg-open` covered by R181)
- [ ] O12: ClaudeCodeRegistrar assumes JSON structure of settings files -- may need to handle edge cases (malformed JSON, read-only permissions). Test coverage added but edge cases remain.
- [x] O13: npm publish workflow documented in README
- [x] O14: App component strategy resolved -- MVP uses iframe for apps with index.html, data.json display for others. No TSX compilation needed.
- [ ] O15: No app versioning or migration strategy for data.json schema changes (R195)
- [ ] O16: No test design for AppsFrontend (React component -- consider integration test approach)
- [x] O17: DashboardServer and DashboardFrontend CRC cards updated with apps routes, SkillsRegistry, and SpacesManager
- [ ] O18: App hot-reload on file change -- /api/apps re-scans on each request, providing eventual consistency. Frontend refresh picks up changes.