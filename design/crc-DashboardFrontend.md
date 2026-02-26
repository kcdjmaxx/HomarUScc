# DashboardFrontend
**Requirements:** R30, R31, R210, R401-R420

## Knows
- wsConnection: WebSocket connection state
- messages: buffered chat messages (max 500)
- events: real-time event log
- status: system status data
- searchResults: memory search results
- activeView: string skill id resolved from SkillsRegistry (R410)
- skillsConfig: dashboard.skills config map fetched from backend (R409)

## Does
- Chat: send messages via WebSocket, display both user and assistant messages with distinct styling
- EventLog: display real-time event stream from WebSocket
- StatusPanel: show system health (channels, memory, timers, queue)
- MemoryBrowser: search memory index, display results
- KanbanView: task board (sidebar skill, order 50)
- CrmView: contact manager (sidebar skill, order 60)
- SpacesView: markdown-based project/task spaces (sidebar skill, order 70)
- AppsView: app launcher showing installed apps from /api/apps (sidebar skill, order 80; R210, R416)
- Sidebar: navigate between views using registry-derived items (R412, R413)
- useWebSocket: manage connection lifecycle, auto-reconnect, buffer messages
- App.tsx: renders active sidebar skill by looking up component in SkillsRegistry (R410, R411)

## Collaborators
- DashboardServer: WebSocket and HTTP API backend
- SkillsRegistry: provides sidebar/apps/headless skill lists, default view, component lookup (R401)
- ThemeProvider: provides current color palette via useTheme() hook

## Sequences
- seq-event-flow.md
- seq-view-registration.md
- seq-apps-load.md
- seq-theme-toggle.md
