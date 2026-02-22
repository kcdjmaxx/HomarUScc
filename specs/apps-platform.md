# Dashboard Apps Platform

**Language:** TypeScript (backend), TypeScript/React (frontend)
**Environment:** Node.js >= 22, Express, WebSocket, Vite, React

The Apps Platform lets Caul build user-facing mini web apps that live inside the HomarUScc dashboard. Max asks Caul to build an app (e.g., "build me a budget tracker"), Caul creates it as a dashboard app, and Max accesses it remotely on his phone via Tailscale. Caul can also read/write the app's state, answer questions about it, and update it on request.

## App Architecture

- Apps are React components registered with the dashboard
- Each app gets its own route in the dashboard (e.g., /apps/budget, /apps/reading-list)
- Apps are discovered from a manifest registry at `~/.homaruscc/apps/` (runtime, user-specific)
- Each app has a manifest file (JSON) describing: name, description, route slug, entry component path, and declared hooks
- Dashboard adds an "Apps" section to the sidebar listing all registered apps
- Clicking an app in the sidebar navigates to its route

## App Manifest Format

Each app lives in a directory under `~/.homaruscc/apps/{slug}/` containing:
- `manifest.json` — metadata and hook declarations
- `component.tsx` — the React component source (compiled to JS at build/load time)
- `data.json` — persisted app state (created on first write)

Manifest schema:
```json
{
  "name": "Budget Tracker",
  "description": "Track expenses and income",
  "slug": "budget",
  "version": "1.0.0",
  "hooks": {
    "read": { "description": "Get current budget data" },
    "write": { "description": "Add or update budget entries", "schema": { ... } },
    "describe": { "description": "Summarize current budget state" }
  }
}
```

## App Hooks (Agent Integration)

- Each app can declare up to three hook types: `read`, `write`, `describe`
- Hooks are exposed as a single MCP tool (`app_invoke`) that takes app slug, hook name, and optional params
- `read` returns the app's current data as JSON
- `write` accepts a JSON payload and merges/replaces app data
- `describe` returns a natural language summary of the app's current state (generated from data)
- When Max asks "what's on my reading list?", Caul calls `app_invoke` with slug=reading-list, hook=describe
- When Max says "add this book", Caul calls `app_invoke` with slug=reading-list, hook=write

## App Data Storage

- Each app gets a `data.json` file in its directory (`~/.homaruscc/apps/{slug}/data.json`)
- Data is a JSON object — apps define their own schema
- The backend reads/writes this file on hook invocations
- Data persists across dashboard restarts (it is just a file)
- Agent accesses app data only through hooks, not by directly reading files

## App Creation Workflow

- Max asks Caul to build an app via Telegram or dashboard chat
- Caul creates the app directory, manifest.json, and component source file using filesystem tools
- Caul calls a `register_app` MCP tool (or the backend auto-discovers on next manifest scan)
- App appears in the dashboard after a page refresh
- Caul can update apps after creation by modifying the component or manifest files

## App Loading Strategy

- On backend startup, scan `~/.homaruscc/apps/*/manifest.json` to build the app registry
- The dashboard frontend fetches the app list from a REST endpoint (`GET /api/apps`)
- App components are loaded dynamically — the backend serves the compiled JS from each app directory
- Frontend uses dynamic import to load app components at runtime
- A file watcher on the apps directory detects new/changed manifests and updates the registry

## Remote Access

- Apps are served through the same Express server as the dashboard (port 3120)
- Accessible over Tailscale at http://100.88.87.74:3120/apps/{slug}
- Mobile-responsive — apps should use the same inline style patterns as the rest of the dashboard

## Security

- Apps run in the same trust boundary as the dashboard (local/Tailscale only)
- No public internet exposure
- App data is local to `~/.homaruscc/apps/`
- No sandboxing of app code — apps are trusted (created by Caul)

## Configuration

- `dashboard.apps.enabled` (default true when dashboard is enabled)
- `dashboard.apps.directory` (default `~/.homaruscc/apps/`)
- No other configuration needed for MVP
