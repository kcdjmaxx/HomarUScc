# DashboardFrontend
**Requirements:** R30, R31

## Knows
- wsConnection: WebSocket connection state
- messages: buffered chat messages (max 500)
- events: real-time event log
- status: system status data
- searchResults: memory search results
- activeView: current panel (chat, events, status, memory)

## Does
- Chat: send messages via WebSocket, display both user and assistant messages with distinct styling
- EventLog: display real-time event stream from WebSocket
- StatusPanel: show system health (channels, memory, timers, queue)
- MemoryBrowser: search memory index, display results
- Sidebar: navigate between views
- useWebSocket: manage connection lifecycle, auto-reconnect, buffer messages

## Collaborators
- DashboardServer: WebSocket and HTTP API backend

## Sequences
- seq-event-flow.md
