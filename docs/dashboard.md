# Dashboard

The HomarUScc dashboard is a single-page web application served by an Express + WebSocket backend. It provides real-time visibility into the agent's event loop, memory, channels, and installed apps.

**Default port:** `3120` (configurable via `config.json`)

## Architecture

```
Browser (React SPA)
    ↕  WebSocket (ws://host:3120)
Express Server (DashboardServer)
    ↕
HomarUScc core (event loop, memory, channels, timers)
```

The backend lives in `src/dashboard-server.ts`. The frontend is a Vite-built React app under `dashboard/`. At startup, the compiled frontend is served as static files from `dashboard/dist/`.

### Two communication paths

| Path | Protocol | Purpose |
|------|----------|---------|
| REST API | HTTP | Status polling, tool calls, app data, config |
| WebSocket | WS | Real-time events, chat messages, search, status pushes |

## WebSocket protocol

The frontend connects via `useWebSocket` (in `dashboard/src/hooks/useWebSocket.ts`). Messages are JSON with a `type` and `payload`:

**Inbound (browser to server):**

| Type | Payload | Effect |
|------|---------|--------|
| `chat` | `{ text }` | Routes message through the dashboard channel adapter into the event loop |
| `search` | `{ query, limit? }` | Runs hybrid vector + FTS memory search, pushes `search_results` back |
| `status` | `{}` | Returns current system status (channels, queue, timers, memory) |
| `events` | `{}` | Returns recent event history |
| `agent-chat` | `{ text }` | Inter-agent chat message |

**Outbound (server to browser):**

| Type | Payload | Description |
|------|---------|-------------|
| `chat` | `{ from, text, timestamp }` | Chat message (from user or agent) |
| `event` | `{ id, type, source, timestamp, payload }` | Real-time event broadcast |
| `status` | Full status object | System status snapshot |
| `search_results` | `SearchResult[]` | Memory search results |
| `error` | `{ message }` | Error notification |
| `agent-chat` | `{ id, from, text, timestamp }` | Inter-agent message |

Every event that passes through the event loop is broadcast to all connected WebSocket clients via `broadcastEvent()`.

## REST API

Key endpoints exposed by the dashboard server:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | System status (loop state, channels, queue, compaction) |
| GET | `/api/events?limit=N` | Recent event history |
| POST | `/api/events` | Inject external event (requires `type`, `source`, `payload`) |
| GET | `/api/timers` | List all scheduled timers |
| GET | `/api/memory/stats` | Memory index statistics |
| GET | `/api/search/unified?q=...` | Unified vault + memory search |
| GET | `/api/identity/soul` | Soul.md content (text/markdown) |
| GET | `/api/identity/user` | User.md content |
| GET | `/api/identity/state` | State.md content |
| GET | `/api/wait?timeout=N` | Long-poll for new events (used by MCP proxy) |
| GET | `/api/health` | Health check (`{ ok: true }`) |
| GET | `/api/tool-list` | List all registered MCP tools |
| POST | `/api/tool-call` | Execute MCP tool (`{ name, args }`) |
| GET | `/api/config/skills` | Dashboard skills enable/disable config |
| GET | `/api/apps` | List registered apps |
| GET | `/api/apps/:slug/data` | Read app data.json |
| PUT | `/api/apps/:slug/data` | Write app data.json |
| POST | `/api/apps/:slug/invoke` | Invoke app hook (`{ hook, data? }`) |

## Frontend views

The dashboard uses a **skills registry** pattern for its views. Each view component self-registers at import time by calling `registerSkill()` from `dashboard/src/skills-registry.ts`.

### Skills registry

```typescript
// dashboard/src/skills-registry.ts
export interface SkillRegistration {
  id: string;           // unique slug ("chat", "events", etc.)
  name: string;         // display name
  icon: string;         // single character
  surface: "sidebar" | "apps" | "headless";
  order: number;        // sort position
  core: boolean;        // true = always visible, not toggleable
  component?: ComponentType<ViewProps>;
}
```

Views self-register at module scope:

```typescript
// Example from Chat.tsx
registerSkill({
  id: "chat",
  name: "Chat",
  icon: ">",
  surface: "sidebar",
  component: Chat as React.ComponentType<ViewProps>,
  order: 10,
  core: true,
});
```

The `App.tsx` imports all view modules (triggering registration), then renders a `Sidebar` driven by the registry and mounts the active view's component.

### Built-in views

| View | ID | Order | Core | Description |
|------|----|-------|------|-------------|
| Chat | `chat` | 10 | yes | Send/receive messages through the dashboard channel |
| Agent Chat | `agent-chat` | 15 | yes | Inter-agent messaging |
| Events | `events` | 20 | yes | Real-time event log with type badges and payloads |
| Status | `status` | 30 | yes | System overview (loop state, queue, channels, memory, timers, skills) |
| Memory | `memory` | 40 | no | Hybrid vector + FTS search over the memory index |
| Kanban | `kanban` | 50 | no | Task board |
| CRM | `crm` | 55 | no | Contact relationship management |
| Journal | `journal` | 60 | no | Reflection journal entries |
| Spaces | `spaces` | 70 | no | Bucket-based knowledge organization |
| Apps | `apps` | 80 | no | Grid of installed apps with data inspection |

Core views cannot be disabled. Non-core views can be toggled via the `dashboard.skills` config key:

```json
{
  "dashboard": {
    "skills": {
      "memory": true,
      "kanban": false
    }
  }
}
```

Keys absent from config default to enabled.

### Chat

The chat view (`dashboard/src/components/Chat.tsx`) provides a message interface to the agent. Messages are sent as WebSocket `chat` type and routed through the `DashboardAdapter` channel into the event loop. Bubbles are styled differently for user vs. agent messages with timestamps.

### Event log

The event log (`dashboard/src/components/EventLog.tsx`) displays all events flowing through the system in reverse chronological order. Each event shows a color-coded type badge (blue for messages, amber for timer_fired, green for tool_call), the source, timestamp, and a truncated JSON payload.

### Status panel

The status panel (`dashboard/src/components/StatusPanel.tsx`) polls the server every 5 seconds and displays:

- **Loop state** (running/stopped)
- **Event queue** depth
- **Timer** count
- **Event history** count
- **Channels** with health indicators (green/red dots)
- **Memory** stats (file count, chunk count, indexed paths)
- **Skills** with state indicators

### Memory browser

The memory browser (`dashboard/src/components/MemoryBrowser.tsx`) provides a search interface for the agent's memory index. Queries run hybrid vector + FTS search and display results with file paths, relevance scores, and content previews.

### Apps view

The apps view (`dashboard/src/components/AppsView.tsx`) lists all installed apps from `~/.homaruscc/apps/`. Clicking an app either:

- Loads its `index.html` in an iframe (if `hasIndex` is true in the manifest)
- Shows the app's metadata and `data.json` contents

Apps with dedicated sidebar views (like kanban) are hidden from the generic list.

## Dashboard adapter

The `DashboardAdapter` (`src/dashboard-adapter.ts`) is a channel adapter that bridges the web dashboard to the event loop. It extends `ChannelAdapter` with channel name `"dashboard"` and mode `"always_on"`.

When a user sends a message from the dashboard chat, the adapter calls `receiveFromDashboard()` which wraps the message and delivers it into the event loop. Outbound messages from the agent are forwarded to all connected WebSocket clients via a registered handler.

## Theming

The frontend supports dark and light themes via a `ThemeProvider` context. The toggle appears in the sidebar footer. Theme preference is persisted in `localStorage`.

## Plugin frontend components

Frontend plugin components can be added to `dashboard/src/plugins/` (gitignored). These `.tsx` files are loaded via Vite's `import.meta.glob` as eager imports, and they self-register using `registerSkill()` just like built-in views.

```typescript
// dashboard/src/plugins/my-view.tsx
import { registerSkill, type ViewProps } from "../skills-registry";

function MyView({ messages, send }: ViewProps) {
  return <div>My custom view</div>;
}

registerSkill({
  id: "my-view",
  name: "My View",
  icon: "M",
  surface: "sidebar",
  component: MyView,
  order: 90,
  core: false,
});
```

## Mobile support

The dashboard is responsive. On viewports narrower than 768px:
- The sidebar collapses into an overlay drawer
- A hamburger button appears in the top-left corner
- Selecting a view closes the drawer automatically

## Startup behavior

On startup, `DashboardServer` will:

1. Scan `~/.homaruscc/apps/` for app manifests
2. Load plugins from `dist/plugins/`
3. Mount plugin routes at `/api/plugins/<slug>/`
4. Merge plugin tools into the MCP tool list
5. Serve the built dashboard SPA from `dashboard/dist/`
6. If the port is in use, attempt to kill the stale process and retry once
7. If the port is still unavailable, continue without the dashboard (degraded mode)

See also: [Plugins](plugins.md) for backend plugin architecture, [Identity](identity.md) for the identity files served via `/api/identity/*`.
