# Dashboard

**Language:** TypeScript (backend), TypeScript/React (frontend)
**Environment:** Node.js >= 22, Express, WebSocket, Vite, React

The dashboard is a web-based UI for interacting with HomarUScc.

## Backend (Express + WebSocket)

- Serves the built React SPA as static files
- HTTP API endpoints for status, events, timers, memory stats, and identity content
- Long-poll endpoint (`/api/wait`) that blocks until events arrive or timeout (returns 204 on timeout, 200 with events)
- WebSocket server for real-time bidirectional communication
- Handles chat messages, memory search requests, status queries, and event streaming over WebSocket
- Auto-recovery from port conflicts (kills stale process on EADDRINUSE)

## Frontend (React SPA)

- Components: Sidebar (navigation), Chat (messaging), EventLog (real-time events), StatusPanel (system health), MemoryBrowser (search interface)
- useWebSocket hook manages connection, auto-reconnect, and message buffering (last 500 messages)
- Chat messages flow: user types → WebSocket → DashboardServer → DashboardAdapter → event loop → Claude Code reasons → calls dashboard_send tool → WebSocket → UI

## Configuration

- Port defaults to 3120
- Can be disabled entirely via config
- Dev server runs on port 3121 with proxy to backend
