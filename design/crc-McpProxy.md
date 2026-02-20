# McpProxy
**Requirements:** R10, R11, R12, R13, R14
**Refs:** ref-mcp-spec

## Knows
- backend: BackendManager (spawns/restarts backend process)
- server: MCP Server instance (stdio transport)
- backendUrl: HTTP base URL for backend API
- wsUrl: WebSocket URL for event notifications

## Does
- main: spawn backend, create MCP server, wire handlers, connect stdio transport
- forwardToolCall: POST to /api/tool-call with timeout, return result or error
- forwardResourceRead: POST to /api/resource, return content
- handleRestartBackend: stop + respawn backend, reconnect WebSocket
- connectNotificationWs: WebSocket client relaying backend events as MCP notifications
- BackendManager.spawn: child_process.spawn backend.js, wait for /api/health
- BackendManager.restart: SIGTERM old process, spawn new, wait for healthy
- BackendManager.stop: SIGTERM and wait for exit

## Collaborators
- Backend (via HTTP): tool-call, tool-list, resource-list, resource, health
- Backend (via WebSocket): event notifications
- Claude Code (via stdio): MCP protocol

## Sequences
- seq-startup.md
