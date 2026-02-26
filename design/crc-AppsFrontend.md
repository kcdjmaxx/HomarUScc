# AppsFrontend
**Requirements:** R185, R188, R199, R200, R203, R210, R416, R422

## Knows
- appList: AppManifest[] -- fetched from GET /api/apps on mount
- selected: string | null -- slug of currently selected app
- appData: Record<string, unknown> | null -- data for the selected app

## Does
- AppsView: top-level component shown when sidebar "Apps" view is active; fetches /api/apps on mount, lists apps as clickable cards; shows empty state when none installed (R210)
- AppRenderer: renders a single app -- if app has index.html, embeds in iframe; otherwise shows manifest info + data.json contents (R185, R200)
- fetchAppList(): GET /api/apps, populate appList state, filter out apps with dedicated sidebar views (R188)
- Self-registers as sidebar skill via registerSkill() at module scope with surface: "sidebar", order: 80 (R416)

## Collaborators
- SkillsRegistry: registers itself as a sidebar skill; in the future, getAppsSkills() could provide additional apps-surface skills
- DashboardServer: serves /api/apps, /api/apps/:slug/data, /api/apps/:slug/static/:file
- App.tsx: renders AppsView when "apps" skill is active via registry lookup

## Sequences
- seq-apps-load.md

## Notes
- The original design called for dynamic import of compiled React components via /api/apps/:slug/component. The current implementation uses a simpler approach: apps with index.html are rendered in iframes, apps without index.html show their data.json. This avoids the complexity of compiling TSX on the backend (O14).
- AppsView fetches the app list directly from /api/apps rather than from getAppsSkills(), since external apps are discovered at runtime and not statically registered in the frontend registry.
