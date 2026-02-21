# DashboardServer
**Requirements:** R24, R25, R26, R27, R28, R29, R32, R151, R152, R153

## Knows
- app: Express application
- server: HTTP server
- wss: WebSocket server
- clients: connected WebSocket clients
- port: configured port (default 3120)

## Does
- start: create Express app, mount routes, start HTTP + WS server
- stop: close server and all WebSocket connections
- setupRoutes: mount /api/status, /api/events, /api/timers, /api/memory/stats, /api/identity/*, /api/wait (with digest vs full identity delivery R151, R152)
- handleWebSocket: process inbound WS messages (chat, search, status, events); echo user chat messages back to all clients
- broadcast: send message to all connected WS clients
- handlePortConflict: kill stale process on EADDRINUSE

## Collaborators
- HomarUScc: provides status, events, memory, identity data
- DashboardAdapter: bridges chat messages to event loop
- MemoryIndex: serves search requests

## Sequences
- seq-event-flow.md
