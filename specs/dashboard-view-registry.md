# Dashboard Skills Registry

**Language:** TypeScript/React
**Environment:** Vite, React 19

The Skills Registry is a unified registration system for all HomarUScc capabilities — sidebar views, external apps, and headless services. It replaces the hardcoded view system in App.tsx and Sidebar.tsx, and unifies the previously separate "built-in views" and "external apps" concepts into a single registry with a `surface` type.

## Skill Surface Types

Every registered skill declares where it appears:

- **`sidebar`** — Built-in React component rendered directly in the dashboard. Gets a first-class navigation entry in the sidebar. Examples: Chat, Spaces, CRM, Kanban.
- **`apps`** — External/standalone app with its own server or URL. Rendered via iframe or link in the Apps launcher page. Examples: budget tracker, reading list.
- **`headless`** — No UI. Backend-only logic: MCP tools, timers, background processes. Registered for status/config visibility but never rendered. Examples: email checker, dream cycle, voice processor.

## Registry Interface

```typescript
interface SkillRegistration {
  id: string;                              // unique slug
  name: string;                            // display name
  icon: string;                            // single character icon
  surface: "sidebar" | "apps" | "headless";
  order: number;                           // position (sidebar sort, apps grid order)
  core: boolean;                           // true = always enabled, not toggleable
  // sidebar-specific
  component?: React.ComponentType<ViewProps>;
  // apps-specific
  url?: string;                            // external app URL for iframe/link
  description?: string;                    // shown in apps launcher
  // headless-specific
  tools?: string[];                        // MCP tools this skill provides
  timers?: string[];                       // timer names this skill manages
}

interface ViewProps {
  messages: WsMessage[];                   // WebSocket message buffer
  send: (msg: object) => void;            // WebSocket send function
}
```

- `surface: "sidebar"` requires `component`.
- `surface: "apps"` requires `url`.
- `surface: "headless"` requires neither — just metadata.
- `core: true` skills are always shown and cannot be disabled.
- Non-core skills can be enabled/disabled via `dashboard.skills` in config.json.
- Sidebar views that don't need `messages` or `send` simply ignore those props.

## Self-Registration Pattern

Each skill registers at module scope as a side effect of import:

```typescript
// Sidebar skill (SpacesView.tsx)
import { registerSkill } from "../skills-registry";
// ... component definition ...
registerSkill({
  id: "spaces",
  name: "Spaces",
  icon: "%",
  surface: "sidebar",
  component: SpacesView,
  order: 70,
  core: false,
});

// Headless skill (registered in backend or a setup file)
registerSkill({
  id: "email-checker",
  name: "Email Checker",
  icon: "✉",
  surface: "headless",
  order: 0,
  core: false,
  tools: ["zoho_read_inbox", "zoho_send_email"],
  timers: ["email-check-morning", "email-check-afternoon", "email-check-evening"],
});
```

The registry module collects registrations in an array. App.tsx imports the registry and all sidebar skill files (which trigger registration). The Sidebar reads sidebar skills from the registry. The Apps page reads apps skills. The Status page can show headless skills.

## Config Integration

Config.json can selectively disable non-core skills:

```json
{
  "dashboard": {
    "skills": {
      "kanban": false,
      "crm": false,
      "email-checker": false
    }
  }
}
```

Skills not mentioned in `dashboard.skills` default to enabled. Core skills ignore this setting entirely. The backend exposes `GET /api/config/skills` returning the enabled/disabled map. The frontend fetches this on startup and filters the registry accordingly.

## Sidebar Rendering

The Sidebar no longer owns a hardcoded items array. Instead, it receives the filtered, sorted list of `surface: "sidebar"` skills from the parent (AppInner). Each item has the same shape as today's items array but is derived from the registry. The active view highlight, click handler, and styling remain unchanged.

## Apps Page Rendering

The Apps page (currently AppsView.tsx) renders `surface: "apps"` skills as cards/tiles with name, icon, description, and a link/iframe to the skill's URL. This replaces the current hardcoded apps list.

## Status Page Integration

The Status page can show `surface: "headless"` skills with their tools and timer info. This gives visibility into background capabilities without requiring a UI.

## View Switching

App.tsx replaces the `View` union type and manual switch statement with a registry lookup. The `view` state becomes a string (the registry id). To render the active view, App.tsx finds the matching sidebar skill and renders its component with ViewProps.

## Order Convention

Core sidebar skills occupy orders 10-30. Non-core sidebar skills start at 40+. The Apps launcher is last at 80. Headless skills use order 0 (not rendered in sidebar).

| Skill          | Surface  | Order | Core |
|----------------|----------|-------|------|
| Chat           | sidebar  | 10    | yes  |
| Events         | sidebar  | 20    | yes  |
| Status         | sidebar  | 30    | yes  |
| Memory         | sidebar  | 40    | no   |
| Kanban         | sidebar  | 50    | no   |
| CRM            | sidebar  | 60    | no   |
| Spaces         | sidebar  | 70    | no   |
| Apps           | sidebar  | 80    | no   |
| Email Checker  | headless | 0     | no   |
| Dream Cycle    | headless | 0     | no   |
| Voice Messages | headless | 0     | no   |

## Migration Path

1. Create `dashboard/src/skills-registry.ts` with the registry, `registerSkill()`, and query helpers (`getSidebarSkills()`, `getAppsSkills()`, `getHeadlessSkills()`).
2. Add `registerSkill()` call to each existing view component file.
3. Update App.tsx to import all sidebar skill files (triggering registration) and use registry for rendering.
4. Update Sidebar.tsx to accept registry-derived items instead of hardcoded array.
5. Update AppsView.tsx to render `surface: "apps"` skills from registry.
6. Add `GET /api/config/skills` endpoint to backend.
7. Fetch skills config on frontend startup and filter registry.
8. Remove the hardcoded `View` union type and `items` array.

No changes to individual view component logic — only a registration call is added to each file and the ViewProps interface is applied (most already accept `messages` and `send`).
