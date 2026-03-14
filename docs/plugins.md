# Plugins

HomarUScc supports backend plugins that register MCP tools, mount Express routes, and store persistent data. Plugins live in `src/plugins/` (TypeScript source) and are loaded from `dist/plugins/` (compiled output) at startup.

## Architecture overview

```
~/.homaruscc/apps/<slug>/
    manifest.json       ← plugin metadata (type: "plugin")
    data.json           ← persistent plugin data

dist/plugins/<slug>/
    index.js            ← compiled plugin entry point

src/plugins/<slug>/
    index.ts            ← plugin source
```

Three modules collaborate to make plugins work:

| Module | File | Role |
|--------|------|------|
| **AppRegistry** | `src/app-registry.ts` | Scans `~/.homaruscc/apps/` for manifests, validates, tracks metadata |
| **AppDataStore** | `src/app-data-store.ts` | Read/write/describe operations on per-app `data.json` files |
| **PluginLoader** | `src/plugin-loader.ts` | Discovers compiled plugins in `dist/plugins/`, loads and initializes them |

## AppRegistry

The `AppRegistry` scans `~/.homaruscc/apps/` at startup, looking for subdirectories containing a `manifest.json`.

### Manifest format

```json
{
  "name": "My Plugin",
  "slug": "my-plugin",
  "description": "What this plugin does",
  "version": "1.0.0",
  "type": "plugin",
  "icon": "icon.png",
  "hooks": {
    "read": { "description": "Read stored data" },
    "write": { "description": "Write data", "schema": {} },
    "describe": { "description": "Get natural language summary" }
  }
}
```

**Required fields:** `name`, `version`

**Optional fields:** `description`, `icon`, `hooks`, `type`

The `slug` is derived from the directory name. If the manifest is missing `name` or `version`, it is logged and skipped. The registry also checks for an `index.html` file in the app directory, setting `hasIndex: true` if found (used by the dashboard to render the app in an iframe).

### Validation

The `validateManifest()` method enforces:
- `name` must be a non-empty string
- `version` must be a non-empty string
- All other fields are optional with sensible defaults

Invalid manifests are logged as warnings and skipped silently.

## AppDataStore

The `AppDataStore` provides per-plugin persistent storage via simple JSON files.

### Operations

| Method | Description |
|--------|-------------|
| `read(slug)` | Returns the parsed contents of `~/.homaruscc/apps/<slug>/data.json`, or `{}` if not found |
| `write(slug, data)` | Writes a JSON object to `data.json` (overwrites entire file) |
| `describe(slug)` | Returns a human-readable summary of the app's state |
| `invoke(slug, hook, params?)` | Dispatches to read/write/describe by hook name |

### The `describe` method

The `describe` method generates a natural-language summary of an app's data, useful for the agent to quickly understand what an app contains:

```
My Plugin (v1.0.0):
What this plugin does
  contacts: 42 items
  lastSync: 2026-03-01T00:00:00Z
  settings: 3 fields
```

Arrays show item counts, objects show field counts, primitives show their value.

### The `invoke` dispatch

The `invoke` method is the MCP tool interface. The `app_invoke` MCP tool calls this with a slug, hook name, and optional parameters:

```typescript
// MCP tool call
app_invoke({ slug: "my-plugin", hook: "read" })
app_invoke({ slug: "my-plugin", hook: "write", data: { key: "value" } })
app_invoke({ slug: "my-plugin", hook: "describe" })
```

Unknown apps or hooks return `isError: true` responses.

## PluginLoader

The `PluginLoader` discovers and loads backend plugins from `dist/plugins/`. Each plugin must export a module conforming to the `PluginExports` interface.

### Plugin interface

```typescript
export interface PluginExports {
  init(dataDir: string): void;       // required — called with ~/.homaruscc/apps/<slug>/
  routes?(router: Router): void;     // optional — register Express routes
  tools?(): PluginToolDef[];          // optional — return MCP tool definitions
  shutdown?(): void;                  // optional — cleanup on backend stop
}

export interface PluginToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: Record<string, unknown>) =>
    Promise<{ content: Array<{ type: string; text: string }> }>;
}
```

### Discovery process

1. Scan `dist/plugins/` for directories containing `index.js`
2. For each discovered plugin:
   - Look for `~/.homaruscc/apps/<slug>/manifest.json`
   - If found, check that `type` is `"plugin"` (skip otherwise)
   - If not found, auto-create a manifest with defaults
3. Dynamic-import the `index.js` module
4. Call `init(dataDir)` with the app's data directory
5. Register the plugin internally

### Route mounting

Plugin routes are mounted at `/api/plugins/<slug>/`:

```typescript
// In your plugin's routes() export:
export function routes(router: Router) {
  router.get("/status", (req, res) => {
    res.json({ ok: true });
  });
  // Accessible at GET /api/plugins/my-plugin/status
}
```

### Tool registration

Plugin tools are merged into the MCP tool list at startup, after all plugins are loaded. They appear alongside built-in tools and are callable through the same MCP protocol.

## Creating a plugin step by step

### 1. Create the source directory

```bash
mkdir -p src/plugins/my-plugin
```

### 2. Write the plugin entry point

```typescript
// src/plugins/my-plugin/index.ts
import type { Router } from "express";

let dataDir: string;

export function init(dir: string): void {
  dataDir = dir;
  console.error("[my-plugin] initialized with data dir:", dir);
}

export function tools() {
  return [
    {
      name: "my_plugin_greet",
      description: "Return a greeting",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name to greet" },
        },
        required: ["name"],
      },
      handler: async (params: Record<string, unknown>) => {
        const name = params.name as string;
        return {
          content: [{ type: "text", text: `Hello, ${name}!` }],
        };
      },
    },
  ];
}

export function routes(router: Router): void {
  router.get("/health", (_req, res) => {
    res.json({ ok: true, dataDir });
  });
}

export function shutdown(): void {
  console.error("[my-plugin] shutting down");
}
```

### 3. Create the manifest

```bash
mkdir -p ~/.homaruscc/apps/my-plugin
```

```json
{
  "name": "My Plugin",
  "slug": "my-plugin",
  "description": "A simple example plugin",
  "version": "1.0.0",
  "type": "plugin"
}
```

If you skip creating the manifest, one will be auto-generated when the plugin is loaded.

### 4. Build and test

```bash
npx tsc               # compiles to dist/plugins/my-plugin/index.js
# Restart the backend to load the plugin
```

### 5. Optional: Add a frontend view

Create a file in `dashboard/src/plugins/my-plugin.tsx` (gitignored directory):

```typescript
import { registerSkill, type ViewProps } from "../skills-registry";

function MyPluginView({ messages, send }: ViewProps) {
  return <div>My Plugin Dashboard</div>;
}

registerSkill({
  id: "my-plugin",
  name: "My Plugin",
  icon: "P",
  surface: "sidebar",
  component: MyPluginView,
  order: 100,
  core: false,
});
```

## Plugin lifecycle

```
Startup:
  1. PluginLoader.loadAll() scans dist/plugins/
  2. For each plugin: import → init(dataDir)
  3. PluginLoader.mountRoutes(app) → registers Express routes
  4. PluginLoader.getAllTools() → tools merged into MCP tool list

Runtime:
  - Tools are callable via MCP protocol
  - Routes handle HTTP requests at /api/plugins/<slug>/
  - Data persists in ~/.homaruscc/apps/<slug>/data.json

Shutdown:
  - PluginLoader.shutdown() calls each plugin's shutdown() method
```

## Data storage patterns

### Simple key-value (via AppDataStore)

The easiest pattern uses `app_invoke` with `read` and `write` hooks. The entire `data.json` is read/written atomically:

```typescript
// Read
const data = appDataStore.read("my-plugin");  // → {}

// Write (replaces entire file)
appDataStore.write("my-plugin", { count: 42, items: ["a", "b"] });
```

### Custom storage (via plugin init)

For more complex needs, plugins can manage their own files in the `dataDir` passed to `init()`:

```typescript
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let dataDir: string;

export function init(dir: string) {
  dataDir = dir;
  // Create custom files, open SQLite databases, etc.
}
```

### REST API access

Plugin data is also accessible via the dashboard REST API:

```bash
# Read
curl http://localhost:3120/api/apps/my-plugin/data

# Write
curl -X PUT http://localhost:3120/api/apps/my-plugin/data \
  -H "Content-Type: application/json" \
  -d '{"count": 42}'

# Invoke hook
curl -X POST http://localhost:3120/api/apps/my-plugin/invoke \
  -H "Content-Type: application/json" \
  -d '{"hook": "describe"}'
```

See also: [Dashboard](dashboard.md) for how apps appear in the frontend, [Docs Vector DB](docs-vectordb.md) for domain-specific knowledge storage.
