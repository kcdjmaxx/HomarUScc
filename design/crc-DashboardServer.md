# DashboardServer
**Requirements:** R24, R25, R26, R27, R28, R29, R32, R151, R152, R153, R186, R190, R191, R192, R198, R207, R221, R222, R310-R318, R408

## Knows
- app: Express application
- server: HTTP server
- wss: WebSocket server
- clients: connected WebSocket clients
- port: configured port (default 3120)
- compactionManager: CompactionManager
- spacesManager: SpacesManager
- appRegistry: AppRegistry -- scans and provides app manifests
- appDataStore: AppDataStore -- read/write/describe for app data.json files
- lastWaitPoll: timestamp of last /api/wait call (R222)
- restartChatId: chat ID for restart result callback (R221)

## Does
- start: create Express app, mount routes, start HTTP + WS server
- stop: close server, SpacesManager, and all WebSocket connections
- setupRoutes: mount API endpoints:
  - /api/status, /api/events, /api/timers, /api/memory/stats, /api/identity/*
  - /api/wait (with digest vs full identity delivery R151, R152)
  - /api/config/skills (R408)
  - /api/checkpoint (R126, R127, R130)
  - /api/agents and /api/agents/:id/complete (R137-R140, R154-R155)
  - /api/restart-result, /api/restart-chat (R221)
  - /api/apps, /api/apps/:slug/data, /api/apps/:slug/invoke, /api/apps/:slug/static (R198, R191, R192, R190)
  - /api/kanban/tasks (CRUD)
  - /api/crm/contacts (CRUD)
  - /api/spaces/* (R310-R318)
  - /api/docs (document viewer)
  - /api/tool-call, /api/tool-list, /api/resource, /api/resource-list
- handleWebSocket: process inbound WS messages (chat, search, status, events)
- broadcast: send message to all connected WS clients
- handlePortConflict: kill stale process on EADDRINUSE

## Collaborators
- HomarUScc: provides status, events, memory, identity data
- DashboardAdapter: bridges chat messages to event loop
- MemoryIndex: serves search requests
- AppRegistry: provides app manifest list and validation
- AppDataStore: handles app data read/write/describe/invoke
- CompactionManager: compaction hooks and stats
- SpacesManager: bucket and item CRUD

## Sequences
- seq-event-flow.md
- seq-apps-startup.md
- seq-apps-invoke.md
- seq-spaces-crud.md
- seq-compaction-checkpoint.md
- seq-telegram-command.md
