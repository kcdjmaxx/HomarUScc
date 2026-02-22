# AppsFrontend
**Requirements:** R185, R188, R199, R200, R203, R210

## Knows
- appList: AppInfo[] — fetched from GET /api/apps on mount
- activeApp: string | null — slug of currently loaded app
- loadedModules: Map<string, React.ComponentType> — cache of dynamically imported components

## Does
- AppsView: top-level component shown when sidebar "Apps" view is active; lists all apps; shows empty state when no apps installed (R210)
- AppShell: wrapper that fetches and dynamically imports a single app component from /api/apps/:slug/component, renders it inside a container (R185, R200)
- fetchAppList(): GET /api/apps, populate appList state (R188)
- loadAppComponent(slug): dynamic import from backend URL, cache in loadedModules (R199, R200)
- AppCard: clickable card in the apps list showing name, description; navigates to app route (R188)

## Collaborators
- Sidebar: adds "Apps" entry to navigation items
- DashboardServer: serves /api/apps and /api/apps/:slug/component
- App.tsx: routes "apps" view and passes slug parameter

## Sequences
- seq-apps-load.md
